# TV store themes

The TV theme layer changes only the visual shell around the existing `/tv` and `/tv2` boards. Menu data, prices, feeds, cards, promotions, tickers, animations, timers, refresh logic, and routes remain owned by the existing TV components.

## Add a store theme with zero new layout code

1. Create `public/tv-theme/<store-code-lowercase>/`.
2. Add four optimized assets with these exact names:
   - `header.webp` — opaque 2172×724 panorama
   - `background.webp` — opaque 1672×941 full-board background
   - `corner-left.png` — transparent 1000×1000 lower-left decoration
   - `corner-right.png` — transparent 1000×1000 lower-right decoration
3. Keep every asset below 500 KB. Use WebP for opaque art and PNG for transparent corners.
4. Add one entry to `TV_THEMES` in `app/tv-theme/theme.ts`, keyed by the existing `tvHiring.store` code.
5. Fill all theme fields: image paths, colors, slogans, and footer copy.
6. Run lint, typecheck, build, and the TV theme test.
7. Verify `/tv` and `/tv2` at 1920×1080 and 3840×2160: no scrolling or overlap, sharp header/logo, full-height cards, and unchanged items, prices, promotions, animations, and timers.

The shared `/tv` pattern keeps the review QR inside the Add Ons rail below the list. `/tv2` never renders the QR. A store without a `TV_THEMES` entry follows the existing unthemed rendering path.

## Optional homepage hero

Add one optimized opaque image at `public/home/<store-code-lowercase>-hero.webp`, below 500 KB. Render it with explicit dimensions, `object-fit: contain`, a matching background, and high fetch priority. Preserve the existing H1, title, meta, canonical, and all content below it.
