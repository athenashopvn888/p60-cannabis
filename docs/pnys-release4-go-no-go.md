# PNYS Release 4 go/no-go checklist

Release 4 remains plan-only. This file does not authorize a PNY01 bridge deploy, alias switch, production environment change, integration switch, or cutover.

## Completed in Release 4-prep (PNYS preview only)

- [x] Opening cash compares the prior close with the new count, requires an explicit warning confirmation on mismatch, audits amount/difference/staff/time, and appears on the final till report.
- [x] `pos_hub.store_runtime` supports `ACTIVE`, `FROZEN`, and `ARCHIVE_READ_ONLY`; every PNYS server mutation is checked in application code and by a database trigger.
- [x] Integration ownership and generation exist for `SCCX_FEED`, `SCCX_ACK`, `SIGNAL`, `SHEET_OUTBOX`, `SHEET_IMPORT`, `STOCK_SNAPSHOT`, and `SETB_SYNC`.
- [x] Delivery evidence is unique by `(channel, cutover_id, event_id)`.
- [x] Tests reject non-owners, old generations, stale leases, and frozen/archive mutations.
- [x] A `FROZEN` PNYS test preview permits only validated Staff/Kitchen/Manager authentication and session writes; operational writes remain blocked and gate failures do not consume PIN attempts.
- [x] Normal PNYS and `TEMPORARILY PAUSED — DO NOT TRADE` builds compile and pass preview-only checks.
- [x] Migration and guarded undo are stored in the repository.

## Go/no-go before the PNY01 bridge deployment

- [ ] Tri names the between-shifts window and separately approves the PNY01 bridge deployment.
- [ ] PNY01 has no active shift; SCCx confirms the shift is closed.
- [ ] Fresh `pny_pos` backup, grants snapshot, integration cursors, outstanding outbox rows, and deployment aliases are captured.
- [ ] PNY01 bridge build is produced from current production and contains only generation/ownership checks; no PNYS feature code.
- [ ] Bridge preview proves current PNY01 owner/generation can read, write, lease and ack while a wrong generation cannot.
- [ ] Current PNY01 production deployment ID and one-step alias rollback command are recorded.

## Go/no-go before cutover

- [ ] Tri separately approves the cutover in a between-shifts window.
- [ ] Final PNY01 close is immutable and accountant-approved.
- [ ] Fresh PNY01 catalog/SKU/price/THC/on-hand/PIN counts and checksums are recorded before the one-time final carryover, then reconciled after it.
- [ ] PNYS opening cash uses the approved prior-close-versus-count confirmation flow.
- [ ] PNYS normal and maintenance deployments are identified and health-checked at 390 px.
- [ ] `pnys_pos` is `FROZEN` during final carryover; it becomes `ACTIVE` exactly once after reconciliation.
- [ ] Every integration channel has one owner, one generation, one cutover ID, and a captured pre-switch cursor.
- [ ] Old owner is disabled before new owner is enabled. No channel has two enabled owners.
- [ ] Customer menu stock switches to PNYS without downtime; PNY01 feed remains available for rollback.
- [ ] Smoke tests pass before staff trade: login, open, sell, refill, close-read, customer menu, Manager and Kitchen.

## Recovery boundary

- **Before the first PNYS transaction:** freeze PNYS, restore all integration owners/cursors to PNY01 generation, point the alias back to the recorded PNY01 deployment, and verify PNY01 writes before unfreezing. No data merge is needed.
- **After any PNYS transaction:** do not point staff back to a writable PNY01 till. Freeze both trading paths, export PNYS sales/shifts/stock/outbox since cutover, reconcile them into the designated recovery store exactly once by event ID, verify balances and delivery receipts, then activate only the recovered owner. This is recovery, not a deployment rollback.

## Retention

- [ ] After cutover, set retained PNY01 to `ARCHIVE_READ_ONLY` for at least 30 days.
- [ ] Keep its database, deployment and customer-menu feed intact for history and controlled recovery.
- [ ] Do not delete PNY01 or its backups during the retention period.
