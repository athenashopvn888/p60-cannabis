# PNY01 staff photo pilot

This is an isolated, upload-only staff mailbox for P60. It does not connect to GBP, Signal, another store, or a fleet database. The future central collector is responsible for validation, GBP posting, Signal morning messages, and incomplete reminders.

## Before enabling

1. Run `supabase/staff-photo-pilot.sql` manually in P60's own Supabase project. It creates a private bucket and private tables with no browser policies.
2. Configure these server-only deployment variables. Never prefix them with `NEXT_PUBLIC_`:
   - `PNY_STAFF_SUPABASE_URL`
   - `PNY_STAFF_SUPABASE_SERVICE_ROLE_KEY`
   - `PNY_STAFF_DAILY_PIN_SECRET` (at least 32 random characters; separate from all other secrets)
   - `PNY_STAFF_SESSION_SECRET` (at least 32 random characters)
   - `PNY_STAFF_RETRIEVAL_TOKEN` (at least 32 random characters)
   - `PNY_STAFF_CLEANUP_TOKEN` (optional separate token; retrieval token is fallback)
   - `CRON_SECRET` (at least 32 random characters; used only by Vercel Cron)
   - `PNY_STAFF_PIN_BOUNDARY_HOUR` (optional, defaults to `6` in Toronto)
   - `PNY_STAFF_PREVIOUS_PIN_GRACE_MINUTES` (optional, defaults to `0`; enabling grace eases shift handoff but delays removal from the prior Signal group)
3. Deploying `vercel.json` registers a once-daily cleanup on every Vercel plan. Vercel calls `GET /api/staff-photo/maintenance/cleanup` with `CRON_SECRET`. The collector may also trigger authenticated cleanup with `POST` and `PNY_STAFF_CLEANUP_TOKEN`.

The setup SQL explicitly grants the server-side `service_role` only the table and sequence operations used by these routes. RLS remains enabled with no `anon` or `authenticated` policies. If collector calls return PostgreSQL `42501`, rerun the latest grant section as the project owner; never weaken RLS or add browser policies.

## Daily PIN contract

The 4-digit PIN is derived only on the server from HMAC-SHA256 over the secret, `PNY01`, operational date, and private generation version. It rotates automatically at 06:00 Toronto time. Staff sessions contain neither the PIN nor secret, are bound to the operational date and generation version, and expire at the next 06:00 boundary.

The collector uses its bearer token with:

- `GET /api/staff-photo/collector/credentials` for store code, login URL, current PIN and validity window.
- `POST /api/staff-photo/collector/credentials/rotate` for emergency same-day rotation. This atomically increments the private version, invalidating the old PIN and all active staff sessions. Audit stores only version and timestamp.

The 4-digit space is intentionally small for staff usability, so the login route enforces six failed attempts per client in 15 minutes using persistent database records. Successful shared-store logins do not consume the lockout allowance. Client network identifiers are HMAC-pseudonymized before storage. The collector token must be protected independently.

## Collector contract

All collector routes require `Authorization: Bearer <PNY_STAFF_RETRIEVAL_TOKEN>`.

- `GET /api/staff-photo/collector/status?day=YYYY-MM-DD`: completion, prompt, random-check, issue and processing metadata.
- `GET /api/staff-photo/collector/media/{uuid}`: streams a private photo or issue attachment; no public or signed bucket URL is exposed.
- `POST /api/staff-photo/collector/ack`: body `{ "kind": "submission", "id": "...", "state": "retrieved|invalid|posted", "deleteObject": true, "note": "..." }`, or kind `issue` with state `retrieved`.

`deleteObject: true` is accepted only as part of a durable acknowledgement. Metadata remains for reporting while the private object is removed. Media access is denied at the exact 24-hour expiry even if the daily physical cleanup has not run yet; cleanup removes the inaccessible object on its next run. Statuses describe processing only; this site does not claim to validate or post to GBP.

## Staff UX

`/staff-photo` is no-index, omitted from navigation and the sitemap, and excluded from the public age gate. Staff can submit one required photo and one optional second photo, complete a deterministic occasional store check, or report an issue with an optional photo/screenshot. Used weekly prompts disappear. Client-side canvas redraw reduces size and strips normal EXIF metadata; the server also enforces MIME and magic bytes.

For visual QA only, a local development server accepts `/staff-photo?preview=login` and `/staff-photo?preview=dashboard`. These fixtures cannot activate in a production build and do not weaken fail-closed production APIs.
