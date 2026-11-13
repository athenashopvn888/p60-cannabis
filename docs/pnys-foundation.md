# PNYS foundation

## Isolation

- Vercel project: `pnys-pos` (`prj_YxPnreV6iBh3AZIrTKKUK1z9tnuJ`).
- Store code: `PNYS`; state schema: `pnys_pos`; shared future-facing schema: `pos_hub`.
- `INTEGRATIONS_ENABLED`, `SCCX_ENABLED`, `SIGNAL_ENABLED`, `SOD_ENABLED`, `SHEET_OUTBOX_ENABLED`, and `SETB_SYNC_ENABLED` are `0` in development, preview, and production environments.
- No PNY01 Google Sheet credentials are copied. `sheetFromEnv()` returns a local disabled client whenever integrations are off, even if credentials are accidentally inherited.
- `POS_DB_SCHEMA=pnys_pos` is enforced by the runtime for PNYS. A mismatched schema fails startup.

## Database change package

- Forward migration: `supabase/migrations/20261113090000_pnys_foundation.sql`.
- Manual rollback: `supabase/undo/20261113090000_pnys_foundation.undo.sql`.
- The forward migration's safety wrapper refuses SQL that writes to `pny_pos`.
- `scripts/pnys-foundation.ts` reads PNY02 and PNY01 in explicit read-only transactions. It creates a permission-restricted PNY02 JSON backup before the PNYS write, then performs exactly one catalog/on-hand clone and records counts and SHA-256 checksums in `pnys_pos.clone_audit`.
- The clone copies products, enabled/price overrides, THC flags, tiers encoded in catalog/category fields, and balances. It does not copy shifts, sales, deposits, staff, sessions, PINs, outbox work, or integrations.
- A second clone is refused when an audit row already exists.

## Shell

Every PNYS page is wrapped by the same mobile shell: fixed store/staff/title/TEST top bar, fixed thumb-sized bottom action bar, and a separately scrolling middle panel. Safe-area insets and a 360px layout are included. The live PNY01 root layout is unchanged.

## Operational order

1. Retain a DB-level backup/restore point and the supplied undo SQL.
2. Apply the migration with `scripts/apply-pnys-migration.ts`.
3. Run the one-time backup/clone with `scripts/pnys-foundation.ts`.
4. Verify the audit row has equal source/target counts and checksums.
5. Configure PNYS-only database and random secrets; keep all integrations disabled.
6. Deploy preview only and verify `/pos`, `/menu`, and 360px shell behavior.
