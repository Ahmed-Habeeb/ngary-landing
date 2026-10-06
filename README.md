# Ngary · نجاري: landing page

A scroll-driven landing page for Ngary's furniture store, in Arabic (RTL, `/ar/`) and English (LTR, `/en/`). The page has one job: get people to **call**.

The protagonist is one armchair. It floats in the hero, gets built step by step in the pinned story (sketch → walnut frame → purple upholstery → placed in a room), comes back as a piece in the room planner and as the map pin, and ends up under a lamp in the final call to action.

**Sections, in order:**
1. Hero
2. Story (pinned, scrubbed)
3. Kinetic marquee
4. Why Ngary (photo bento)
5. Rooms (stacking photo cards)
6. Pieces (pinned horizontal photo gallery; a swipe row on phones)
7. **Design your room** (an interactive planner)
8. How it works (line drawing)
9. Measure your space (dimension drawing)
10. Visit (photo + map)
11. A second marquee
12. FAQ
13. Final call
14. Footer

Stack: Vite 8 (vanilla JS) · Tailwind CSS v4 (CSS-first `@theme`) · GSAP 3.15 + ScrollTrigger · Readex Pro via `@fontsource-variable`. No other animation or scroll libraries.

```bash
npm install
npm run dev        # http://localhost:5173/ar/  and  /en/
npm run build      # → dist/
npm run preview    # serves dist/ on http://localhost:4173
npm run verify     # build + headless-Chrome checks + contact sheets (verify-output/)
npm run og         # re-render public/og/*.png (needs preview running)
```

## Live demo (GitHub Pages)

**https://ahmed-habeeb.github.io/ngary-landing/**. The root page redirects to `/ar/` or `/en/`.

Every push to `main` deploys automatically through `.github/workflows/deploy-pages.yml`:
1. It runs `npm ci`.
2. It builds with `vite build --base=/ngary-landing/` and sets `SITE_URL` to the Pages URL.
3. It publishes `dist/`.

You can also start a deploy by hand from the repo's **Actions** tab ("Run workflow").

Locally, nothing changes: `npm run dev` and `npm run build` use base `/`. The base path is a build setting:
- photo, logo and asset URLs are rewritten by Vite
- the language links use `{{@base}}`
- the root redirect page uses relative links

GitHub Pages only publishes a **private** repo on a paid plan. That's why this repo is public.

## Where things live

| Path | What |
|---|---|
| `src/template.html` | **The only page markup.** Both languages render from it. |
| `src/i18n/ar.json`, `en.json` | All copy, meta tags and placeholders. A missing key fails the build. |
| `src/partials/*.svg` | The chair (layered story version + `<symbol>`), the planner's pieces (`designer-sprite.svg`), map, measuring plan, CTA scene, intro outline. |
| `assets-src/photos/` → `public/img/` | Source photos and their AVIF/WebP variants, produced by `python3 scripts/images.py` (Pillow). `src/img-manifest.json` feeds the `<!-- img:name -->` template directive. Credits are in `CREDITS.md`. |
| `vite.config.js` | The tiny `nagary-i18n` plugin (`{{key}}`, `{{key_html}}`, `<!-- include:… -->`) and `SITE` (canonical origin). |
| `src/css/main.css` | Tokens (`@theme static`), components, and the unlayered rules that must beat utilities. |
| `src/js/main.js` | One `gsap.matchMedia()` (desktop/tablet/mobile/reduce) calling each section in page order. |
| `src/js/motion.js` | Plugin registration + helpers: `$`, `$$`, `reveal`, `splitWords`, `magnetic`, `dirSign`, `finePointer`. |
| `src/js/sections/*.js` | One module per section, `(conditions, contextSafe) => cleanup`. |
| `scripts/verify.mjs` | The verification suite (see below). |

`ar/index.html` and `en/index.html` are one-line stubs. Edit the template and the JSON, not those files.

## Behaviour per mode

- **Desktop:**
  - the story pins for 3.5 screens and snaps to each step (`labelsDirectional`, no inertia, so a flick can't skip a step)
  - pointer tilt on the hero chair and magnetic call buttons
- **Tablet:** shorter pin, no snap, smaller movement, fewer floating swatches.
- **Mobile:**
  - the story pins only if `innerHeight >= 680`; otherwise the sticky stage scrubs over in-flow captions
  - no backdrop blur
  - a fixed bottom **Call** bar
- **Reduced motion:** no pins, parallax, rotation or reveals. The story jumps instantly to each step as its caption is read. Room cards become a plain list.
- **No JavaScript:**
  - a complete page; the story shows the finished chair in its room next to all four captions, and the intro never appears
  - the room planner's colour pickers still work (CSS `:has()`); only adding, moving and removing pieces needs JS
  - the FAQ uses native `<details>`

**Room planner:**
- Presets: living, bedroom, dining and office.
- Wall, floor, fabric and wood colours.
- Sixteen pieces to add or remove. Drag them with a mouse or touch, or move them with the arrow keys (Shift for bigger steps) and remove them with Delete.
- A live summary to read out on the phone, a copy button, and reset.
- The design is remembered in `localStorage` on this device only.

## Verification

`npm run verify` builds, starts `vite preview` and checks:
- **The matrix:** ar/en × {motion, reduced motion, JS off} × viewports 360×640, 390×664, 390×844, 430×932, 768×1024, 1024×768, 1280×800, 1440×900 and 1920×1080.
- **Problems that fail a run:** console errors or warnings (so any GSAP warning), page errors, failed or ≥400 requests, horizontal overflow at every scroll step, broken images or `<use>` references.
- **Page structure:** exactly one `h1`, correct `lang`/`dir`, hreflang/canonical/OG tags.
- **Story:** pinned or not as expected per viewport, and every step reached. In-flow captions are never hidden.
- **Content after scrolling:** every revealed element ends visible. Room cards fit on screen when stuck.
- **Header and hero:** the header doesn't flicker during snap, and the Arabic headline is split into words, never letters.
- **Intro and resize:** the intro lifts in ≤1.3s, and with `main.js` blocked the CSS failsafe still lifts it. Resizing 1280→800→1280 mid-story rebuilds the pin cleanly.

Contact sheets (one per run) are written to `verify-output/sheets/`; `verify-output/report.json` has the details. Filter runs with `--only=motion,reduce,nojs,intro,resize`, `--langs=ar` or `--vp=1440x900`.

## Contact details

- **Phone:** +20 100 549 3601 (`tel:+201005493601`). Set in `phone` in both JSON files and used by every call button.
- **Showroom:** Menyet Shebeen, Shibin El Qanater, Qalyubia, Egypt, with the [Google Maps link](https://maps.app.goo.gl/KiF7diruFPpd5qVL8). Set in `visit.address` / `visit.mapUrl`. Both also feed the `FurnitureStore` structured data in the page head.

## Placeholders to replace

All are marked `data-placeholder` in the markup (the verify report counts them):

| What | Where |
|---|---|
| Logo (text wordmark for now) and favicon | `.wordmark` in the template, `public/favicon.svg` |
| Custom domain (if you get one) | set it in the repo's Settings → Pages; the workflow picks the new URL up automatically |
| OG share images | `public/og/og-*.png` (generated placeholder cards, `npm run og`) |
| `og:locale` territory (`ar_AR` / `en_US`) | `meta.ogLocale` in both JSON files |
| Real product and showroom photos. The current ones are free stock photos, labelled "Inspiration photo" on the page (see `CREDITS.md`). | `assets-src/photos/` + `python3 scripts/images.py` |
