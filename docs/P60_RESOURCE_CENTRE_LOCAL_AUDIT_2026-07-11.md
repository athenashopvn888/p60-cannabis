# P60 Resource Centre Local Audit

Date: 2026-07-11
Host checked locally: `http://localhost:3060`
Canonical host expected: `https://p60cannabis.com`

## Summary

- Resource routes checked: 24
- HTTP 200: pass
- One visible H1 per page: pass
- Unique title tags: pass
- Unique meta descriptions: pass
- Unique H1s: pass
- Unique primary keywords: pass
- Self-referencing canonicals: pass
- Sitemap inclusion: pass
- Article or CollectionPage schema: pass
- Breadcrumb schema: pass
- Visible author and handle: pass
- Internal page links: pass
- Raw Markdown or planning labels exposed publicly: pass
- Desk, AI writer, bot, QLC, or Queen Lansdowne public identity leakage: pass
- Desktop/mobile smoke check: pass for resource pages; existing horizontal nav strip is intentionally scrollable.

## Build and Lint

- `npm run build`: pass
- Scoped lint for changed resource/nav/sitemap/config files: pass with 2 existing image optimization warnings.
- Full `npm run lint`: blocked by pre-existing unrelated errors in blog admin, AgeGate, Magnifier, games, TV pages, and scripts.

## Redirects Added

- `/blog/p60-cannabis-category-menu-cheat-sheet` -> `/resources/cannabis-101/how-to-read-a-cannabis-menu`
- `/blog/p60-cannabis-flower-tier-guide` -> `/resources/flower-guides/aa-vs-aaa-vs-premium-vs-exotic`
- `/blog/p60-cannabis-local-visit-guide-adults-19` -> `/resources/local-guides/weed-dispensary-in-york`

## Route Correction

The footer quick link formerly pointing to `/info/weed-store-near-mississauga` was corrected to the actual P60 SEO route `/info/weed-store-near-toronto`.

## Native Cigarette Inventory Update

- Inventory source checked: public `/items/cigarettes` page against `ITEMS_LIVE.csv`
- Cigarette carton price phrase added to resources: cheap native cigarettes at $25 per carton
- Public-menu $25 carton lines documented: Rolled Gold Lights, Canadian Full, Canadian Lights, Canadian Menthol, Canadian Classics Original, Canadian Classics Silver, Canadian Goose Full, Canadian Goose Lights, Nexus Full, Nexus Lights, Putters, Time Full.
- Non-carton cigarette-category items were not included in the $25/carton claim: Backwoods and Grabba listings on the public page, plus Belmont KS pack-only, nicotine pouches, and 10 X Premium Mix Cigarettes from the master CSV.
- Master CSV $25/carton rows that were not on the public page during this check were not presented as available: Rolled Gold Full, BB Full Carton, BB Lights Carton, Playfare Ultra Lights, Time Lights.
