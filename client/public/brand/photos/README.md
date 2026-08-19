# Photography drop-zone

Every editorial photo slot in the storefront renders through
`components/ui/PhotoSlot.tsx`. It is given a SLUG, never a path: the file names,
the widths on disk and the alt text all live in `src/data/photos.js`. With no
slug — or with one that has no derivatives on disk — it draws a flat creamDeep
block carrying the name of the shot, so the build is never broken and no
broken-image icon ever appears.

## How to light a slot up

1. Drop the raw file in `client/assets-src/raw/`.
2. Add it to `SHOTS` in `client/scripts/prep-photos.mjs` with its crop, then
   `npm --prefix client run photos:prep`.
3. `npm --prefix client run images` to emit the WebP + JPEG derivatives into
   `client/public/photos/opt/`.
4. Add an entry to `SITE_PHOTOS` in `client/src/data/photos.js` for good alt
   text, and pass the slug as `photo="<slug>"`.

Sources live in `assets-src/`, NOT in `public/` — vite copies `public/` into
`dist` verbatim, so a multi-megabyte source nobody requests would be deployed.

## Shots that exist

| Slug | Used by | On disk |
|---|---|---|
| `club-sandwich` | `components/Hero.jsx`, memories row | 1007×1258 |
| `smoothies` | memories row | 1007×843 |
| `banana-nutella` | memories row | 602×957 |

All three were supplied as Instagram screenshots with the carousel arrows and
dot indicators baked into the pixels, and `banana-nutella` had a caption burned
into the frame. They are cropped once at prep time — see `prep-photos.mjs` for
why that is not a CSS job.

## Still missing

| # | Shot | Wanted for | Aspect | Target width |
|---|------|-----------|--------|--------------|
| 1 | People eating at the bench — three or four frames | the MEMORIES row, which is seeded with food photos as a stand-in | 4:5 | 800px |
| 2 | The hero plate, reshot landscape or square | `components/Hero.jsx` — the current split works precisely *because* the only shot available is portrait; a wider frame would open the layout up | ≥1:1 | 1600px |

Notes:

- Widths are 2× the largest rendered CSS size, for retina.
- The MEMORIES row is driven by the `MEMORIES` array in
  `components/MemoriesStrip.jsx`. Swapping the seeded food photos for pictures
  of people is three lines in that array plus three entries in `photos.js` — no
  JSX changes.
- These are NOT the menu card images. Those are the cut-out PNGs in
  `client/public/menu/`, which go through the same optimiser but keep a PNG
  fallback because their alpha channel is the point.
