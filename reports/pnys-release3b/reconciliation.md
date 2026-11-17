# PNYS Release 3b — Database Dry Run

Status: **PASSED AND CLEANED**

Scope: PNYS preview database only. No `pny_pos` or `pny1-pos` access.

## Rows exercised

| Schema/table | Test rows |
|---|---:|
| `pnys_pos.live_state` | 1 temporary PNYS document, restored exactly |
| `pnys_pos.shift` | 1 |
| `pnys_pos.sale` | 2 |
| `pnys_pos.refill` | 1 |
| `pnys_pos.stock_count` | 1 |
| `pnys_pos.deposit` | 1 |
| `pnys_pos.closing` | 1 |
| `pos_hub.customer` | 1 |
| `pos_hub.customer_consent` | 1 |
| `pos_hub.customer_visit` | 1 |
| `pos_hub.coupon` | 1 |
| `pos_hub.coupon_redemption` | 1 |
| `pos_hub.policy_audit` | 1 guarded backup row |

All identifiers/data were marked `DRY-R3B`; the guarded cleanup removed them.

## Database reconciliation

| SKU | Opening | Refills | Sales | Expected | Counted | Variance |
|---|---:|---:|---:|---:|---:|---:|
| 9901-3g | 6 | 0 | 0 | 6 | 6 | 0 |
| 9902 | 10 | 3 | 2 | 11 | 10 | -1 |
| 9903 | 5 | 0 | 1 | 4 | 4 | 0 |

- Gross merchandise: $55.00
- Coupon: -$10.00
- Net sales: $45.00
- Cash / debit: $40.00 / $5.00
- Deposit: $40.00
- Cash variance: $0.00
- Stock short: $25.00

> **ACCOUNTANT DECISION REQUIRED — opening-float formula remains a placeholder.**

## Cleanup proof

- Pre/post `live_state` version: 20 / 20
- Full `live_state` checksum restored: `4dfe7eb19b4512e271dce7e39f68024f45d771459e0e6c0ee78469beab23884f`
- Balance checksum restored: `8993d56cd6646d2ae00a5185bf5b267c7f3476d638d9308f513a3665e6cf91d3`
- Balance rows / units restored: 206 / 1,210
- All affected table counts before/after: 0 / 0
- Remaining `DRY-R3B` rows: 0
