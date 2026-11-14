# PNY01 customer menu feed (Release 1 baseline)

This records the current code path without changing the live PNY01 menu.

- Customer UI: `/menu`; JSON: `GET /api/menu`; orders: `POST /api/menu/orders`.
- The browser requests with `cache: no-store` at load and every 20 seconds.
- The server response is dynamic and `PosService.menu()` keeps an in-process cache for 45 seconds. A state-changing POS operation invalidates that cache generation.
- In the current one-store PNY01 project, stock comes from `pny_pos.live_state` for `PNY01`. The till resolves presentation and selling prices in layers: the persisted product/store-product rows; the PNY `Flowers_Raw` mirror (with the published `FLOWERS_LIVE` CSV as a read-only fallback); `Items_raw_price` (maintained from the read-only SETB Items CSV plus Tri-standard overrides); cigarette-pack rules; and the committed/customer catalog fallback. The public `GET /api/menu` response is the final observable result of those layers for positive, sellable stock.
- The original PNYS clone incorrectly treated only the customer-menu feed as the full till catalog. The Release 1 reconciliation snapshots all of the read-only till sources, materializes every balance SKU, records each SKU's resolution layer in `pnys_pos.clone_audit`, and leaves PNYS independent of PNY01 Sheet credentials afterward.
- An item is shown only when the catalog product is active, the PNY01 store-product row is enabled, on-hand is greater than zero, and the resolved price is greater than zero. Stocked catalog/master fallback rows are also excluded at zero quantity.
- The API labels all returned items `Available`. Ordering is enabled only while the till has an active, opened, unblocked shift.
- Current behavior does **not** apply the shift's WEED / NO WEED answer inside `menu()`. In other words, an otherwise eligible THC item is not removed from the customer menu merely because the active shift answered NO WEED. This is a documented baseline, not a new rule.
- PNYS uses the same `/menu` and `/api/menu` code paths, but reads `pnys_pos.live_state` for `PNYS` and is wrapped by the persistent `TEST STORE` shell until cutover.

Cutover design: verify the PNYS feed first, switch the public menu alias/feed to PNYS atomically, retain the PNY01 deployment/feed as rollback, and do not remove or rewrite PNY01 history.
