# PNY01 staff photo pilot

This is an isolated staff mailbox for P60 Cannabis. It uses the project-linked private Vercel Blob store for photos, issue attachments, login lockout records, prompt usage, completion/report metadata, and emergency PIN version state. It does not connect to GBP, Signal, another store, or a fleet database. The future central collector is responsible for automated validation, GBP posting, Signal morning messages, and incomplete reminders.

## Production storage

Create one private Blob store linked to the `gas-junction` Vercel project and Production environment. Vercel supplies `BLOB_READ_WRITE_TOKEN` to the project automatically. Never copy that value into client code or prefix it with `NEXT_PUBLIC_`.

The application keeps:

- private media at unique `staff-photo/media/...` paths;
- a small private `staff-photo/state/v1.json` operational record;
- optimistic concurrency through Blob ETags for every state mutation;
- fresh state reads with `useCache: false`;
- operational-day media retention: each 06:00-06:00 Toronto batch remains retrievable for the full following operational day, producing a 24-to-48-hour window;
- durable metadata after retrieval or media deletion.

No Supabase project is created or used for this feature. The staff-photo runtime is isolated to this site's private Vercel Blob store.

## Server-only deployment variables

- `BLOB_READ_WRITE_TOKEN` (created automatically by the linked private Blob store)
- `PNY_STAFF_DAILY_PIN_SECRET` (at least 32 random characters; separate from all other secrets)
- `PNY_STAFF_SESSION_SECRET` (at least 32 random characters)
- `PNY_STAFF_RETRIEVAL_TOKEN` (at least 32 random characters)
- `PNY_STAFF_CLEANUP_TOKEN` (optional separate token; retrieval token is fallback)
- `CRON_SECRET` (at least 32 random characters; used only by Vercel Cron)
- `PNY_STAFF_PIN_BOUNDARY_HOUR` (optional, defaults to `6` in Toronto)
- `PNY_STAFF_PREVIOUS_PIN_GRACE_MINUTES` (optional, defaults to `0`)

Deploying `vercel.json` registers idempotent cleanup at both `15 10 * * *` and `15 11 * * *`. The paired UTC schedules provide a 06:15 Toronto cleanup through daylight and standard time; the off-season call is a safe no-op before expiry or an idempotent retry after it. Vercel calls `GET /api/staff-photo/maintenance/cleanup` with `CRON_SECRET`. The collector may also call authenticated `POST` cleanup with `PNY_STAFF_CLEANUP_TOKEN`.

## Daily PIN contract

The four-digit PIN is derived only on the server from HMAC-SHA256 over the secret, `PNY01`, operational date, and private generation version. It rotates automatically at 06:00 Toronto time. Staff sessions contain neither the PIN nor secret, are bound to the operational date and generation version, and expire at the next 06:00 boundary.

The collector uses its bearer token with:

- `GET /api/staff-photo/collector/credentials` for store code, login URL, current PIN and validity window.
- `POST /api/staff-photo/collector/credentials/rotate` for emergency same-day rotation. The private state version is atomically incremented, invalidating the old PIN and all active staff sessions. Audit state stores only version and timestamp.

The four-digit space is intentionally small for staff usability, so the login route enforces six failed attempts per client in 15 minutes using private persistent state. Successful shared-store logins do not consume the lockout allowance. Client network identifiers are HMAC-pseudonymized before storage.

## Collector contract

All collector routes require `Authorization: Bearer <PNY_STAFF_RETRIEVAL_TOKEN>`.

- `GET /api/staff-photo/collector/status?day=YYYY-MM-DD`: completion, prompt, random-check, issue and processing metadata.
- `GET /api/staff-photo/collector/media/{uuid}`: streams a private photo or issue attachment through the authenticated function. No Blob URL or store token is exposed.
- `POST /api/staff-photo/collector/ack`: body `{ "kind": "submission", "id": "...", "state": "retrieved|invalid|posted", "deleteObject": true, "note": "..." }`, or kind `issue` with state `retrieved`.

Acknowledgement state is persisted before requested media deletion. If deletion fails, the private path remains in state so the collector can retry without duplicating a GBP post. Metadata remains for completion/reporting after the object is removed. Media access expires at 06:00 Toronto after the full additional operational-day retry window, even if physical cleanup has not yet run. Current and prior operational-day batches can therefore overlap; staff sessions and PINs remain scoped only to the current operational day.

## Staff UX

`/staff-photo` is no-index, omitted from navigation and the sitemap, and excluded from the public age gate. Staff can submit one required photo and one optional second photo, complete a deterministic occasional store check, or report an issue with an optional photo/screenshot. Used weekly prompts disappear. Client-side canvas redraw reduces size and strips normal EXIF metadata; the server also enforces MIME and magic bytes.

For visual QA only, a local development server accepts `/staff-photo?preview=login` and `/staff-photo?preview=dashboard`. These fixtures cannot activate in a production build and do not weaken fail-closed production APIs.
