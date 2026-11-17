# PNYS production environment repair

This runbook is intentionally value-free. Never paste secret values into this file, a terminal transcript, chat, a Vercel export, or Git.

## Required production variables

| Variable | Approved source | Repair classification | Consumers that must match |
| --- | --- | --- | --- |
| `POS_SUPABASE_DB_URL` | Supabase project `eboqxdxwtilkwwqinfnj`, existing PNYS till role | Existing role; reset its password only after Tri approves if the original is unavailable | `pnys-pos` server runtime only |
| `SESSION_SECRET` | Secure original if recoverable; otherwise cryptographically regenerate | Regenerate if unavailable | PNYS browser sessions, command replay/idempotency, Manager/Kitchen/Staff sessions |
| `SHIFT_SECRET` | Secure original if recoverable; otherwise cryptographically regenerate | Regenerate if unavailable | SCCx shift start/end/sales/open-PIN callers and PNYS shift APIs |
| `ADMIN_SECRET` | Secure original if recoverable; otherwise cryptographically regenerate | Regenerate if unavailable | PNYS protected admin mutations and replay protection |
| `CRON_SECRET` | Secure original if recoverable; otherwise cryptographically regenerate | Regenerate if unavailable | Vercel cron authorization for sheet import/outbox, stock snapshot, ticket expiry, SETB sync, and reconciliation |
| `ROSTER_SECRET` | Secure original if recoverable; otherwise cryptographically regenerate | Regenerate if unavailable | SCCx roster/import/upsert caller and PNYS roster APIs |
| `SCCX_POLL_SECRET` | Secure original if recoverable; otherwise cryptographically regenerate | Regenerate if unavailable | SCCx closed-shift feed, summary image, and acknowledgement callers |
| `SALES_FEED_TOKEN` | Secure Windows user environment source `PNY_SALES_FEED_TOKEN` | Original available | Central Manager/Kitchen consumers of PNYS sales and stock feeds |
| `PNY_MASTER_PIN_HASH` | Tri enters the existing Master PIN in the local masked prompt | Re-hash locally | PNYS Master login only |
| `PNY_KITCHEN_PIN_HASH` | Tri enters the existing Kitchen PIN in the local masked prompt | Re-hash locally | PNYS Kitchen login only |
| `PNY_DEMO_PIN_HASH` | Tri enters the existing Demo PIN in the local masked prompt | Re-hash locally | PNYS Demo login only |

Changing `SESSION_SECRET` invalidates existing browser sessions once. Coordinate that change between shifts.

## Local PIN hashing

Run `scripts/prepare-pnys-production-pin-hashes.ps1`. It prompts twice using masked input, enforces the existing PIN rules, sends only the PIN through local process input to the scrypt helper, and writes only hashes under the current Windows user's local application-data folder. It does not call Vercel.

## Deploy gates

- `npm run verify:pnys-predeploy` refuses the wrong Vercel project, store code, database schemas, blank/redacted secrets, malformed database URLs, weak secrets, and malformed PIN hashes.
- `npm run verify:pnys-postdeploy -- https://deployment-url` performs a read-only database transaction, confirms an active PNYS shift is readable, checks all three POS routes, and fails if the PNYS database role has write privileges on `pny_pos.live_state`.
- The first restored build must use a deployment URL only. Do not change the `pny1-pos.vercel.app` alias until Tri separately approves promotion between shifts.

## Root cause evidence

At **2026-11-16 11:38:16 Bangkok time**, a PowerShell loop PATCHed the environment records for `POS_SUPABASE_DB_URL` and the three special-login PIN hashes from preview-only to both preview and production. The records had been selected from a `decrypt=false` Vercel API response, so this promoted non-authoritative/redacted preview records instead of restoring production from the original sources. The four production records were updated between **11:38:18 and 11:38:23 Bangkok time**.

The unsafe operation was equivalent to:

```powershell
foreach ($id in $selectedRedactedEnvironmentRecordIds) {
  '{"target":["preview","production"]}' |
    npx vercel api "/v9/projects/prj_YxPnreV6iBh3AZIrTKKUK1z9tnuJ/env/$id" `
      -X PATCH --input - --scope athenashopvn888-2439s-projects
}
```

The selected record IDs came from the temporary `pnys-envs.json` response created with `decrypt=false`; a prior temporary `pnys-preview-check.env` came from `vercel env pull`. Neither file is an approved restoration source. The new gate makes redacted placeholders and malformed values a hard build failure.
