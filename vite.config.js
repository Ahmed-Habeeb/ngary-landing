import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = (...p) => resolve(root, 'src', ...p);

// Public URL of the site (no trailing slash), used for canonical, og:url,
// hreflang and structured data. The GitHub Pages workflow sets SITE_URL;
// locally it falls back to a placeholder origin.
export const SITE = (process.env.SITE_URL || 'https://ngary.example').replace(/\/$/, '');
// Vite's `base` ('/' locally, '/ngary-landing/' on GitHub Pages). Set from
// the resolved config so in-page links (which Vite does not rewrite) follow it.
let BASE = '/';

const LANGS = {
  ar: { dir: 'rtl', other: 'en' },
  en: { dir: 'ltr', other: 'ar' },
};

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Tiny build-time templating so both languages share ONE copy of the markup
 * (and of the large SVG partials) instead of two hand-synced pages.
 *
 *  <!-- include:partials/x.svg id=hero -->  inline a partial; `{{@id}}` inside it
 *                                           becomes "hero" (unique SVG ids per instance)
 *  {{a.b.c}}        dictionary value, HTML-escaped
 *  {{a.b.c_html}}   dictionary value, raw (only for <em>/<bdi>/<br> in copy)
 *  {{@lang}} {{@dir}} {{@other}} {{@site}} {{@base}}  page variables
 *
 * A missing key throws, so a blank string can never ship silently.
 */
function render(lang) {
  const dict = JSON.parse(readFileSync(src('i18n', `${lang}.json`), 'utf8'));
  const vars = { lang, dir: LANGS[lang].dir, other: LANGS[lang].other, site: SITE, base: BASE };

  const include = (html, depth = 0) =>
    html.replace(/<!--\s*include:(\S+)((?:\s+\w+=\S+)*)\s*-->/g, (_, file, args) => {
      if (depth > 5) throw new Error(`include depth exceeded at ${file}`);
      const params = Object.fromEntries(
        [...args.matchAll(/(\w+)=(\S+)/g)].map((m) => [m[1], m[2]]),
      );
      let part = readFileSync(src(file), 'utf8');
      part = part.replace(/\{\{@(\w+)\}\}/g, (m, k) => (k in params ? params[k] : m));
      return include(part, depth + 1);
    });

  const html = pictures(include(readFileSync(src('template.html'), 'utf8')));

  return html.replace(/\{\{\s*([@\w.]+)\s*\}\}/g, (_, key) => {
    if (key.startsWith('@')) {
      const v = vars[key.slice(1)];
      if (v === undefined) throw new Error(`[i18n] unknown page variable ${key}`);
      return v;
    }
    const v = key.split('.').reduce((o, k) => (o == null ? o : o[k]), dict);
    if (v === undefined || v === null) throw new Error(`[i18n:${lang}] missing key "${key}"`);
    return key.endsWith('_html') ? String(v) : esc(v);
  });
}

// sizes presets for responsive photos (match the CSS layout of each slot)
const SIZES = {
  room: '(min-width: 768px) 55vw, 100vw',
  piece: '(min-width: 1024px) 20vw, (min-width: 768px) 30vw, 72vw',
  why: '(min-width: 1024px) 45vw, (min-width: 768px) 50vw, 100vw',
  visit: '(min-width: 1024px) 50vw, 100vw',
};

/**
 *  <!-- img:room-living sizes=room alt=rooms.living.photo [eager] -->
 * → <picture> with AVIF + WebP srcsets, explicit width/height (no layout
 * shift) and lazy loading unless `eager`. Widths and the intrinsic size come
 * from src/img-manifest.json, written by scripts/images.py. `alt` is a
 * dictionary key; without it the image is decorative (alt="").
 */
function pictures(html) {
  const manifest = JSON.parse(readFileSync(src('img-manifest.json'), 'utf8'));
  return html.replace(/<!--\s*img:(\S+)((?:\s+\w+(?:=\S+)?)*)\s*-->/g, (_, name, args) => {
    const m = manifest[name];
    if (!m) throw new Error(`[img] unknown image "${name}" (run python3 scripts/images.py)`);
    const p = Object.fromEntries([...args.matchAll(/(\w+)(?:=(\S+))?/g)].map((x) => [x[1], x[2] ?? true]));
    const set = (ext) => m.widths.map((w) => `/img/${name}-${w}.${ext} ${w}w`).join(', ');
    const sizes = SIZES[p.sizes] || '100vw';
    const fallback = m.widths[Math.min(1, m.widths.length - 1)];
    const load = p.eager ? 'fetchpriority="high"' : 'loading="lazy"';
    return (
      `<picture><source type="image/avif" srcset="${set('avif')}" sizes="${sizes}">` +
      `<source type="image/webp" srcset="${set('webp')}" sizes="${sizes}">` +
      `<img src="/img/${name}-${fallback}.webp" width="${m.width}" height="${m.height}" alt="${p.alt ? `{{${p.alt}}}` : ''}" ${load} decoding="async"></picture>`
    );
  });
}

function i18nPages() {
  const watched = [src('template.html'), src('partials'), src('i18n'), src('img-manifest.json')];
  return {
    name: 'nagary-i18n',
    configResolved(config) {
      BASE = config.base;
    },
    transformIndexHtml: {
      // 'pre' runs before Vite parses the HTML, so the <script type=module> and
      // <link rel=stylesheet> inside the rendered template get processed normally.
      order: 'pre',
      handler(html, ctx) {
        const m = ctx.path.match(/^\/(ar|en)\/index\.html$/);
        if (m) return render(m[1]);
        // the root redirect page only needs the site URL
        return html.replace(/\{\{@site\}\}/g, SITE);
      },
    },
    // The template/partials/JSON are not in the module graph, and a normal
    // full-reload for /src/template.html would not match the /ar/ page, so
    // force a reload of every page when any of them changes.
    hotUpdate({ file }) {
      if (this.environment.name !== 'client') return;
      if (watched.some((w) => file.startsWith(w))) {
        this.environment.hot.send({ type: 'full-reload', path: '*' });
        return [];
      }
    },
  };
}

export default defineConfig({
  appType: 'mpa',
  plugins: [i18nPages(), tailwindcss()],
  // The dependency scanner only sees the 1-line stub pages, so tell it up front.
  optimizeDeps: { include: ['gsap', 'gsap/ScrollTrigger'] },
  build: {
    target: 'es2020',
    rolldownOptions: {
      input: {
        root: resolve(root, 'index.html'),
        ar: resolve(root, 'ar/index.html'),
        en: resolve(root, 'en/index.html'),
      },
    },
  },
  preview: { port: 4173, strictPort: true },
});
