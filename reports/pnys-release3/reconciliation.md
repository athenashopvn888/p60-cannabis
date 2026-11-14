# PNYS Release 3 Dry Run Reconciliation

Status: **PASSED**  
Scope: PNYS preview simulation only; no persistent PNYS customer, sale, stock or shift rows were created.

## End-to-end proof

- Staff PIN login: passed (ephemeral PIN, hash only; PIN never printed or saved)
- Customer + coupon cash sale: $50.00 - $10.00 = $40.00
- Kitchen refill: 3 sent, 3 staff-confirmed for 9902
- Manager WEED -> NO WEED: audited; THC sale blocked
- Second sale: $5.00 debit
- Mobile closing: count submitted, $25.00 stock short, $40.00 deposited
- Manager closing report: present

## Stock reconciliation

| SKU | Product | Opening | Refills | Sales | Expected | Counted | Variance | Value |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 9901-3g | Dry Run Flower | 6 | 0 | 0 | 6 | 6 | 0 | $0.00 |
| 9902 | Dry Run Paper | 10 | 3 | 2 | 11 | 10 | -1 | $25.00 |
| 9903 | Dry Run Lighter | 5 | 0 | 1 | 4 | 4 | 0 | $0.00 |

Formula checked per SKU: **opening + confirmed refills - completed sales = expected**; expected + variance = counted.

## Cash reconciliation

| Item | Amount |
|---|---:|
| Gross merchandise sales | $55.00 |
| Coupon discount | -$10.00 |
| Net recorded sales | $45.00 |
| Cash sales | $40.00 |
| Debit sales | $5.00 |
| Final deposit | $40.00 |
| End float entered for dry run | $0.00 |
| Direct cash variance | $0.00 |

Cash check: **cash sales - deposit - end float = $0.00**. Stock shortage is reported separately and does not invent cash.

## Opening-float formula

> **ACCOUNTANT DECISION REQUIRED — PLACEHOLDER ONLY.**
>
> Candidate A: next opening expected float = prior closing end float.  
> Candidate B: next opening expected float = manager-approved opening float.  
> No formula was selected or applied in this dry run.

## Cleanup / rollback

The run is isolated in MemoryDb. All generated shift, customer, coupon, refill, sale and closing records disappear when the process exits. The accompanying undo SQL is guarded to remove only records prefixed with `RELEASE3-` if this fixture is ever persisted later.
