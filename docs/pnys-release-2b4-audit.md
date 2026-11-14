# PNYS Release 2b Part 4 Audit Register

This register applies to PNYS preview only. `fixed` means Release 2b Part 4 changed it. `already fixed` means an accepted earlier PNYS release resolved it. `deferred` means the remaining work belongs to an approved later release or requires a database, environment, or accounting decision.

| ID | Status | Resolution | Regression test |
| --- | --- | --- | --- |
| B01 | already fixed | Special-login PINs are env-held hashes and missing hashes fail closed. | `missing special-login hashes fail closed`; `the env-hashed kitchen PIN opens only the kitchen login` |
| B02 | already fixed | Polls use detached reads and no longer project/rewrite the state document. | `PNYS poll paths are detached reads and legacy projection rewrites are removed` |
| B03 | already fixed | Durable leased outbox, authenticated CRON, retry/backoff, failure visibility and manual recovery are implemented. Preview integrations remain intentionally off. | `outbox claims prevent overlapping CRON runs from sending a row twice`; `outbox CRON authenticates...` |
| B04 | already fixed | Close-start has a timeout and recovers by rereading committed server state. | `close start timeout recovers by rereading committed server state` |
| B05 | fixed | The summary image never passes an undefined border style to `next/og`. | `closing summary image never passes an undefined border to next/og` |
| B06 | already fixed | Deposit references are store-unique and near-duplicate amounts require server confirmation. | `same-amount deposits warn on the server...`; `shift end refuses a deposit bag reference already used by the store` |
| B07 | already fixed | Client command keys survive retries and durable receipts prevent duplicate commands after restart. | `durable client command keys survive retries...`; `a retry after a service restart returns the durable receipt...` |
| B08 | deferred | Release 2c will show both opening-float calculations until Tri/accountant chooses one. | No formula is selected or changed in this release. |
| B09 | fixed | Blind staff variance and refill lines retain their signed dollar values, so shorts no longer display as $0. | `staff variance lines retain dollar values without revealing expected stock` |
| B10 | fixed | “Done, I posted it” clears the local authenticated view and does not reload the revoked session. | `closing summary stays until Done after session revoke` |
| B11 | fixed | Counts 10+ away from expected, or equal to the SKU number, require an explicit second confirmation. | `unusual closing counts require an explicit second confirmation` |
| B12 | deferred | Durable normalized stock-history tables require a reviewed migration and undo SQL. No database change is authorized in this release. | Existing sheet-history behavior remains covered by `stock history appends one row per changed SKU...` |
| B13 | already fixed | The five missing SKUs are catalogued/THC flagged and sized flower SKUs fail closed as THC. | `PNY01 NO WEED hides flagged SKUs...`; PNYS catalog reconciliation tests |
| B14 | already fixed | PNYS has a reconciled 273-product catalog and every audited balance SKU has a priced catalog row. | `till reconciliation gives every audited balance SKU a catalog row` |
| B15 | fixed | Historical close/float lookup now selects only a shift that ended before the rendered shift started. | `historical close rendering uses the shift that ended before the rendered shift` |
| B16 | deferred | This release bounds idempotency receipts to seven days, but moving audit/ledger/count history out of `live_state` needs the B12 migration. | `expired idempotency receipts are purged and new receipts carry a seven-day expiry` |
| B17 | already fixed | Database `FOR UPDATE` locking serializes cross-instance mutations; simultaneous stock commands cannot lose units. | `PNYS mutations take a database row lock...`; simultaneous sale/refill and concurrent cashout tests |
| B18 | fixed | Five wrong staff PINs cool down only the hashed client identity for 15 minutes; the store shift is not locked. | `five bad PINs cool down one client without locking the shift...` |
| B19 | already fixed | Sales feed is a detached, bounded, cursor-paginated read. | `the sales feed returns new sales once...`; PNYS poll-path source test |
| B20 | deferred | The original finding concerns `pny1-pos` production secrets, which are outside this release. No PNYS env change is needed or made. | PNYS fail-closed and isolation tests cover runtime behavior without exposing secret values. |
| B21 | fixed | Both till POST clients convert non-JSON gateway/error pages into a clear retry message. | `non-JSON till failures use a clear retry message` |
| B22 | deferred | Expense entry, receipt evidence and Manager approval belong to the mobile closing/Manager releases; no value is invented. | `the closing summary lists off SKUs only...` confirms the current explicit zero. |
| B23 | already fixed | PNYS uses one release branch/PR and explicit project-bound preview deploys with recorded rollback IDs. | `PR #189 head SHA and pnys-pos project binding` are verified in each release. |
| B24 | deferred | Hard-coded temporary PINs are removed and PNYS is store-isolated; centralized multi-store Kitchen is Release 2d. | Special-login role isolation and PNYS store-isolation tests. |
| B25 | already fixed | Closing search/add accepts every known catalog SKU, including zero-quantity SKU 240. | `preview closing count can search and add known zero-quantity SKU 240` |
