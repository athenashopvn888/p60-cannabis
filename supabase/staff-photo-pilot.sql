-- PNY01 staff-photo pilot. Run manually in this site's isolated Supabase project.
-- This file does not connect to or mutate any live project by itself.

create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pny-staff-photo-private', 'pny-staff-photo-private', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.staff_photo_settings (
  id boolean primary key default true check (id),
  pin_version integer not null default 1 check (pin_version > 0),
  updated_at timestamptz not null default now()
);
insert into public.staff_photo_settings (id, pin_version) values (true, 1) on conflict (id) do nothing;

create table if not exists public.staff_photo_pin_audit (
  id bigint generated always as identity primary key,
  pin_version integer not null,
  rotated_at timestamptz not null default now()
);

create table if not exists public.staff_photo_login_attempts (
  id bigint generated always as identity primary key,
  client_key text not null check (char_length(client_key) <= 96),
  succeeded boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists staff_photo_login_attempts_window on public.staff_photo_login_attempts (client_key, created_at desc);

create table if not exists public.staff_photo_submissions (
  id uuid primary key default gen_random_uuid(),
  day_key date not null,
  week_key text not null,
  slot smallint not null check (slot in (1,2)),
  prompt_key text not null,
  object_path text,
  original_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  byte_size integer not null check (byte_size between 1 and 5242880),
  status text not null default 'pending' check (status in ('pending','retrieved','invalid','posted','expired')),
  validation_note text check (char_length(validation_note) <= 500),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  retrieved_at timestamptz,
  posted_at timestamptz
);
create index if not exists staff_photo_submissions_expiry on public.staff_photo_submissions (expires_at) where object_path is not null;
create unique index if not exists staff_photo_active_day_slot on public.staff_photo_submissions (day_key, slot) where status in ('pending','retrieved','posted');
create unique index if not exists staff_photo_active_week_prompt on public.staff_photo_submissions (week_key, prompt_key) where status in ('pending','retrieved','posted');

create table if not exists public.staff_photo_issues (
  id uuid primary key default gen_random_uuid(),
  day_key date not null,
  category text not null,
  note text check (char_length(note) <= 500),
  status text not null default 'open' check (status in ('open','retrieved','resolved')),
  attachment_path text,
  attachment_mime text check (attachment_mime is null or attachment_mime in ('image/jpeg','image/png','image/webp')),
  attachment_bytes integer check (attachment_bytes is null or attachment_bytes between 1 and 5242880),
  attachment_expires_at timestamptz,
  created_at timestamptz not null default now(),
  retrieved_at timestamptz
);
create index if not exists staff_photo_issues_expiry on public.staff_photo_issues (attachment_expires_at) where attachment_path is not null;

create table if not exists public.staff_photo_random_checks (
  day_key date primary key,
  check_key text not null,
  question text not null,
  result text not null check (result in ('ok','issue')),
  issue_id uuid references public.staff_photo_issues(id) on delete set null,
  completed_at timestamptz not null default now()
);

alter table public.staff_photo_settings enable row level security;
alter table public.staff_photo_pin_audit enable row level security;
alter table public.staff_photo_login_attempts enable row level security;
alter table public.staff_photo_submissions enable row level security;
alter table public.staff_photo_issues enable row level security;
alter table public.staff_photo_random_checks enable row level security;
-- Deliberately no anon/authenticated policies. The server-only service role is the sole caller.

-- RLS bypass does not grant PostgreSQL table privileges. Grant only the operations
-- used by the server routes, and keep browser roles explicitly unprivileged.
grant usage on schema public to service_role;

revoke all on table public.staff_photo_settings from anon, authenticated;
revoke all on table public.staff_photo_pin_audit from anon, authenticated;
revoke all on table public.staff_photo_login_attempts from anon, authenticated;
revoke all on table public.staff_photo_submissions from anon, authenticated;
revoke all on table public.staff_photo_issues from anon, authenticated;
revoke all on table public.staff_photo_random_checks from anon, authenticated;

grant select on table public.staff_photo_settings to service_role;
grant select, insert, delete on table public.staff_photo_login_attempts to service_role;
grant select, insert, update on table public.staff_photo_submissions to service_role;
grant select, insert, update on table public.staff_photo_issues to service_role;
grant select, insert, update on table public.staff_photo_random_checks to service_role;

revoke all on sequence public.staff_photo_login_attempts_id_seq from anon, authenticated;
revoke all on sequence public.staff_photo_pin_audit_id_seq from anon, authenticated;
grant usage, select on sequence public.staff_photo_login_attempts_id_seq to service_role;

create or replace function public.rotate_staff_photo_pin()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare next_version integer;
begin
  update public.staff_photo_settings
  set pin_version = pin_version + 1, updated_at = now()
  where id = true
  returning pin_version into next_version;
  insert into public.staff_photo_pin_audit (pin_version) values (next_version);
  return next_version;
end;
$$;
revoke all on function public.rotate_staff_photo_pin() from public, anon, authenticated;
grant execute on function public.rotate_staff_photo_pin() to service_role;
