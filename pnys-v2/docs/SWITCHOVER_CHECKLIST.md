# PNYS v2 switchover checklist (plan only)

This document does not authorize a switchover. Every item waits for Tri's explicit `OK SWITCH` in a zero-active-shift gap.

## Before the gap

1. Verify the v2 release on ACD01: close parity, stock/time/money corrections, undo, audit, approved-send outbox, isolation, RLS, restore drill.
2. Build the candidate and rollback candidate in the isolated `pnys-v2` project with no production alias.
3. Confirm the current PNYS deployment ID and capture a full encrypted backup.
4. Confirm catalog count/checksum, staff count, historical row counts, and current stock total expected at the gap.

## Gap (target under 30 minutes)

1. Require zero active PNYS shifts and no close/refill confirmation in progress.
2. Fence PNYS v1 integrations by advancing the ownership generation; freeze v1 writes for the move only.
3. Copy only: staff and PIN hashes; catalog/prices/tier/THC; freshly counted on-hand; immutable shifts/sales/refills/closes/audit history.
4. Reconcile staff count, catalog count/checksum, history row counts/checksums, every SKU balance, and total on-hand units.
5. Run one v2 test sale and void; prove no net stock/cash change and no old-schema write.
6. Transfer SCCx, group, email, and sheet ownership once. Prove old generations cannot lease, send, or acknowledge.
7. Swap `pny1-pos.vercel.app` to the verified v2 candidate.
8. Verify staff login, sale, void, Manager, Kitchen, SCCx poll, Order group, email dry-run, and current balances.

## Go/no-go and rollback

- Any mismatch or failed check is NO-GO.
- One-step rollback restores the prior alias and prior integration generation together; do not replay already accepted v2 transactions.
- Preserve PNYS v1 read-only for seven clean days, then retire its app/workers/crons and retain its backup forever.
