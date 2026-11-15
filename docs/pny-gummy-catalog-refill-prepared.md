# PNY01 / PNYS Knock Out gummy catalog recovery — prepared only

Status: **PR-ready only. Do not apply while any PNY01 shift is open.**

## Verified source and cause

- SETB source row 64 defines `655, 656, 657` as active `EDIBLES`, named `KNOCK OUT GUMMIES`, with `1500mg / 3000mg / 5000mg` and `$25 / $35 / $50`.
- `Items_raw_price` row 44 materializes only SKU `655` (`KNOCK OUT GUMMIES 1500MG`, `$25`, source row 64). It has no rows for 656 or 657.
- PNY01 `pny_pos.live_state` has no product/store-product records for 655/656/657. Its balance has 655 = 2 and no 656/657 rows. The till's sheet overlay can therefore expose 655, while 656/657 have neither a materialized price row nor a positive balance.
- PNYS already has enabled 656/657 products priced at 3500/5000 cents, but their generic names are normalized by this patch and their balances are currently zero.
- No current Randy refill row or batch was written for 656/657. The recovery uses explicit deterministic batch IDs rather than claiming an existing batch.

## Prepared catalog diff

| SKU | Name | Category | Price |
| --- | --- | --- | ---: |
| 656 | KNOCK OUT GUMMIES 3000MG | EDIBLES | $35.00 |
| 657 | KNOCK OUT GUMMIES 5000MG | EDIBLES | $50.00 |

The same normalization is prepared for PNY01 and PNYS. Both SKUs are enabled and THC-flagged, matching SKU 655's product family.

## Prepared one-time refill

| Store | Batch ID | SKU | Before | Delta | After |
| --- | --- | --- | ---: | ---: | ---: |
| PNY01 | `RANDY-PNY01-2026-11-15-KNOCK-OUT` | 656 | 0 | +2 | 2 |
| PNY01 | `RANDY-PNY01-2026-11-15-KNOCK-OUT` | 657 | 0 | +2 | 2 |
| PNYS | `RANDY-PNYS-2026-11-15-KNOCK-OUT` | 656 | 0 | +2 | 2 |
| PNYS | `RANDY-PNYS-2026-11-15-KNOCK-OUT` | 657 | 0 | +2 | 2 |

Each store gets two `CONFIRMED` incoming rows and two matching stock-ledger rows. Re-running a complete batch is a no-op; a partial batch fails closed. Any active, locked, or closing shift fails closed.

## Apply transaction (only after Tri's between-shifts approval)

The runner executes one database transaction:

```sql
BEGIN;
SELECT version, updated_at, doc FROM pny_pos.live_state WHERE store_code = 'PNY01' FOR UPDATE;
SELECT version, updated_at, doc FROM pnys_pos.live_state WHERE store_code = 'PNYS' FOR UPDATE;
INSERT INTO pos_hub.policy_audit (...) VALUES (... exact pre-change PNY01 document ...);
UPDATE pny_pos.live_state
SET doc = $prepared_document, version = version + 1, updated_at = now()
WHERE store_code = 'PNY01' AND version = $version_before;
INSERT INTO pos_hub.policy_audit (...) VALUES (... exact pre-change PNYS document ...);
UPDATE pos_hub.store_runtime SET write_mode = 'ACTIVE' WHERE store_code = 'PNYS' AND write_mode = 'FROZEN';
UPDATE pnys_pos.live_state
SET doc = $prepared_document, version = version + 1, updated_at = now()
WHERE store_code = 'PNYS' AND version = $version_before;
UPDATE pos_hub.store_runtime SET write_mode = 'FROZEN' WHERE store_code = 'PNYS' AND write_mode = 'ACTIVE';
COMMIT;
```

The full old documents, versions, timestamps, and checksums are saved in `pos_hub.policy_audit` before either live-state update. Any error rolls the whole transaction back.

Before the PNY01 production build is promoted, duplicate the complete `Items_raw_price` tab as the hidden backup `Items_raw_price_backup_2026-11-15_656657`. Then append exactly these two rows using the existing column order:

| SKU | Category | Name | Unit_Price | Source_Row |
| --- | --- | --- | ---: | ---: |
| 656 | EDIBLES | KNOCK OUT GUMMIES 3000MG | 35 | 64 |
| 657 | EDIBLES | KNOCK OUT GUMMIES 5000MG | 50 | 64 |

Do not alter the existing 655 row. The sheet undo is to restore `Items_raw_price` exactly from that hidden backup; the database undo below restores both live-state documents.

## Undo

`supabase/undo/20261115180000_pny_gummy_catalog_refill.undo.sql` restores both exact pre-change documents only if neither store has an open shift and each version is exactly one above its backup version. Otherwise it stops without a partial restore.
