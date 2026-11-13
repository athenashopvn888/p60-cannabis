# PNY01 customer menu feed (Release 1 baseline)

This records the current code path without changing the live PNY01 menu.

- Customer UI: `/menu`; JSON: `GET /api/menu`; orders: `POST /api/menu/orders`.
- The browser requests with `cache: no-store` at load and every 20 seconds.
- The server response is dynamic and `PosService.menu()` keeps an in-process cache for 45 seconds. A state-changing POS operation invalidates that cache generation.
- In the current one-store PNY01 project, the source of truth is `pny_pos.live_state` for `PNY01`. Product presentation can additionally read configured raw-price/flower/item/master catalog sheet rows. PNYS deliberately receives none of those live Sheet credentials; its catalog and stock come only from the one-time clone in `pnys_pos`.
- An item is shown only when the catalog product is active, the PNY01 store-product row is enabled, on-hand is greater than zero, and the resolved price is greater than zero. Stocked catalog/master fallback rows are also excluded at zero quantity.
- The API labels all returned items `Available`. Ordering is enabled only while the till has an active, opened, unblocked shift.
- Current behavior does **not** apply the shift's WEED / NO WEED answer inside `menu()`. In other words, an otherwise eligible THC item is not removed from the customer menu merely because the active shift answered NO WEED. This is a documented baseline, not a new rule.
- PNYS uses the same `/menu` and `/api/menu` code paths, but reads `pnys_pos.live_state` for `PNYS` and is wrapped by the persistent `TEST STORE` shell until cutover.

Cutover design: verify the PNYS feed first, switch the public menu alias/feed to PNYS atomically, retain the PNY01 deployment/feed as rollback, and do not remove or rewrite PNY01 history.
