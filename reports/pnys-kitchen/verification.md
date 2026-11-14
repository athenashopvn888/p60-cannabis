# PNYS Kitchen verification

- Scope: PNYS preview only.
- Kitchen send result: `PENDING_CONFIRM` for SKU 240, quantity 1.
- Stock before send: 37.
- Stock while pending: 37.
- Stock after staff confirmation: 38.
- Stock after replaying the same confirmation: 38.
- Exactly-once result: passed.
- Cleanup: original `live_state` checksum restored, proof refill rows remaining 0, SKU 240 restored to 37.
- Final gate: PNYS `FROZEN`, generation 1.
- Backup: retained in `pos_hub.policy_audit` as `DRY_KITCHEN_BACKUP` with id `4b0b0000-0000-4000-8000-000000000001`.
- Recovery SQL: `supabase/undo/20261114193000_pnys_kitchen_proof.undo.sql`.
- PNY01, `pny_pos`, PINs and STAFF were not changed.
