// Headless-Chrome verification for the Ngary landing page.
//
//   npm run verify            (build + this script; starts `vite preview` itself)
//   node scripts/verify.mjs --only=motion,reduce,nojs --langs=ar,en --vp=1440x900
//
// Matrix: ar/en × viewports × {motion, reduce, nojs}, plus intro/failsafe and
// resize-mid-story checks. Each scroll run scrolls in small increments (like a
// person; big jumps confuse velocity-aware snapping), screenshots every step
// and tiles the shots into contact sheets in verify-output/sheets/.
// Exit code 1 if any assertion fails.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 4173;
const BASE = `http://localhost:${PORT}`;
const OUT = resolve('verify-output');
const SHEETS = resolve(OUT, 'sheets');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const pick = (key, all) => (args[key] ? String(args[key]).split(',') : all);

const VIEWPORTS = [
  [360, 640], // short phone → no pin, sticky scrub
  [390, 664], // real iPhone Safari visible height → no pin
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1280, 800],
  [1440, 900],
  [1920, 1080],
].filter(([w, h]) => !args.vp || String(args.vp).split(',').includes(`${w}x${h}`));
const LANGS = pick('langs', ['ar', 'en']);
const MODES = pick('only', ['motion', 'reduce', 'nojs', 'intro', 'resize']);
const CONCURRENCY = Number(args.concurrency || 3);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const placeholders = new Map();

// ───────────────────────── server ─────────────────────────
async function up() {
  try {
    const r = await fetch(`${BASE}/ar/`);
    return r.ok;
  } catch {
    return false;
  }
}
let server;
if (!(await up())) {
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 50 && !(await up()); i++) await sleep(200);
  if (!(await up())) throw new Error('vite preview did not start');
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(SHEETS, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--hide-scrollbars', '--font-render-hinting=none'],
});

// ───────────────────────── helpers ─────────────────────────
function isPhone(w) {
  return w < 1024;
}

/** A fresh, isolated page with all problem listeners attached. */
async function openPage({ w, h, js = true, reduce = false, introSeen = true, block }) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const problems = [];
  page.on('console', (m) => {
    const type = m.type();
    // The failsafe test aborts main.js on purpose; Chrome logs that abort.
    if (block && block.test(m.location()?.url || '')) return;
    if (type === 'error' || type === 'warn' || type === 'warning' || /gsap|scrolltrigger/i.test(m.text())) {
      problems.push(`console.${type}: ${m.text()}`);
    }
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => {
    if (block && block.test(r.url())) return; // intentionally aborted
    problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`);
  });
  if (block) {
    await page.setRequestInterception(true);
    page.on('request', (r) => (block.test(r.url()) ? r.abort() : r.continue()));
  }
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: isPhone(w), hasTouch: isPhone(w) });
  if (!js) await page.setJavaScriptEnabled(false);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }]);
  if (introSeen) {
    await page.evaluateOnNewDocument(() => {
      try {
        sessionStorage.setItem('nagary:intro', '1');
      } catch {}
    });
  }
  return { page, context, problems };
}

/** Scroll by `dy` in small rAF steps (≈ a fast wheel), then wait until settled (snap). */
async function humanScroll(page, dy, settleMs) {
  await page.evaluate(
    (dy) =>
      new Promise((done) => {
        const step = Math.sign(dy) * Math.min(48, Math.abs(dy));
        let left = dy;
        const tick = () => {
          const d = Math.abs(left) < Math.abs(step) ? left : step;
          window.scrollBy(0, d);
          left -= d;
          if (Math.abs(left) > 0.5) requestAnimationFrame(tick);
          else done();
        };
        requestAnimationFrame(tick);
      }),
    dy,
  );
  // wait for scroll to stop moving (snap may still be animating)
  let last = -1;
  let stable = 0;
  for (let i = 0; i < 40 && stable < 3; i++) {
    await sleep(100);
    const y = await page.evaluate(() => window.scrollY);
    stable = y === last ? stable + 1 : 0;
    last = y;
  }
  await sleep(settleMs);
}

/** Static checks every page must pass. */
async function staticChecks(page, lang) {
  return page.evaluate((lang) => {
    const errs = [];
    const html = document.documentElement;
    const want = lang === 'ar' ? 'rtl' : 'ltr';
    if (html.lang !== lang) errs.push(`html lang=${html.lang}`);
    if (html.dir !== want) errs.push(`html dir=${html.dir}`);
    if (document.querySelectorAll('h1').length !== 1) errs.push(`h1 count=${document.querySelectorAll('h1').length}`);
    for (const hl of ['ar', 'en', 'x-default']) {
      if (!document.querySelector(`link[rel=alternate][hreflang="${hl}"]`)) errs.push(`missing hreflang ${hl}`);
    }
    if (!document.querySelector('link[rel=canonical]')) errs.push('missing canonical');
    if (!document.title.trim()) errs.push('empty title');
    if (!document.querySelector('meta[name=description]')?.content) errs.push('missing description');
    if (!document.querySelector('meta[property="og:image"]')?.content) errs.push('missing og:image');
    if (!document.querySelector('.skip-link[href="#main"]')) errs.push('missing skip link');
    for (const use of document.querySelectorAll('use')) {
      const href = use.getAttribute('href') || use.getAttribute('xlink:href') || '';
      if (!href.startsWith('#') || !document.getElementById(href.slice(1))) errs.push(`broken <use> ${href}`);
    }
    for (const el of document.querySelectorAll('[role=img]')) {
      if (!el.getAttribute('aria-label')) errs.push('role=img without aria-label');
    }
    const ph = {};
    document.querySelectorAll('[data-placeholder]').forEach((el) => {
      ph[el.dataset.placeholder] = (ph[el.dataset.placeholder] || 0) + 1;
    });
    return { errs, ph };
  }, lang);
}


/** Room planner + FAQ. Colours (CSS :has) and <details> must work with and
 *  without JS; adding/moving/removing pieces is JS-only. Synchronous only:
 *  with JS disabled in the page, timers never fire. */
async function interactionChecks(page, js) {
  const errs = [];
  const r = await page.evaluate((js) => {
    const out = {};
    const y0 = window.scrollY;
    const root = document.querySelector('.designer');
    const v = (name) => getComputedStyle(root).getPropertyValue(name).trim().toLowerCase();
    // select radios without focusing them (focus would scroll the page)
    const pick = (id) => {
      const input = document.getElementById(id);
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    out.items0 = root.querySelectorAll('.d-item').length;
    out.wall0 = v('--wall');
    pick('d-wall-lilac');
    pick('d-seat-lilac');
    pick('d-floor-stone');
    out.wall = v('--wall');
    out.seat = v('--seat');
    out.floor = v('--floor-a');
    if (js) {
      const count = () => root.querySelectorAll('.d-item').length;
      root.querySelector('.d-toggle[data-item="bed"]').click();
      out.added = count();
      out.pressed = root.querySelector('.d-toggle[data-item="bed"]').getAttribute('aria-pressed');
      const sofa = root.querySelector('.d-item[data-type="sofa"]');
      const x0 = parseFloat(sofa.style.getPropertyValue('--x'));
      sofa.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      out.moved = parseFloat(sofa.style.getPropertyValue('--x')) !== x0;
      sofa.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
      out.sofaGone = !root.querySelector('.d-item[data-type="sofa"]') || true; // removal animates out
      out.sofaState = root.querySelector('.d-toggle[data-item="sofa"]').getAttribute('aria-pressed');
      root.querySelector('.d-preset[data-preset="office"]').click();
      out.office = count();
      out.officeWall = document.getElementById('d-wall-charcoal').checked;
      out.summary = root.querySelector('[data-d-summary]').textContent.trim();
      try { out.saved = !!JSON.parse(localStorage.getItem('nagary:room')).items.desk; } catch { out.saved = false; }
      root.querySelector('[data-d-reset]').click();
      out.reset = count();
      try { localStorage.removeItem('nagary:room'); } catch {}
    } else {
      pick('d-wall-linen');
      pick('d-seat-plum');
      pick('d-floor-oak');
    }
    const items = [...document.querySelectorAll('.faq-item')];
    out.faqCount = items.length;
    items[2].open = true; // exclusive accordion (name=faq) closes the others
    out.faqOpen = items[2].open;
    out.faqExclusive = items.filter((d) => d.open).length;
    items[0].open = true;
    window.scrollTo(0, y0);
    return out;
  }, js);
  if (r.items0 !== 7) errs.push(`room planner starts with ${r.items0} pieces, expected 7 (living room)`);
  if (r.wall0 !== '#e6d7c3') errs.push(`room planner default wall ${r.wall0}`);
  if (r.wall !== '#dccdeb') errs.push(`wall colour did not change (${r.wall})`);
  if (r.seat !== '#b79ad6') errs.push(`fabric colour did not change (${r.seat})`);
  if (r.floor !== '#d6cfc5') errs.push(`floor did not change (${r.floor})`);
  if (js) {
    if (r.added !== 8 || r.pressed !== 'true') errs.push(`adding a bed: ${r.added} pieces, aria-pressed=${r.pressed}`);
    if (!r.moved) errs.push('arrow key did not move the sofa');
    if (r.sofaState !== 'false') errs.push('Delete did not remove the sofa');
    if (r.office !== 6 || !r.officeWall) errs.push(`office preset: ${r.office} pieces, charcoal wall=${r.officeWall}`);
    if (!r.summary || !r.summary.includes('(6)')) errs.push(`summary "${r.summary}"`);
    if (!r.saved) errs.push('design was not saved to localStorage');
    if (r.reset !== 7) errs.push(`reset left ${r.reset} pieces`);
  }
  if (r.faqCount !== 6) errs.push(`FAQ has ${r.faqCount} items`);
  if (!r.faqOpen) errs.push('FAQ item did not open');
  if (r.faqExclusive !== 1) errs.push(`FAQ: ${r.faqExclusive} items open at once`);
  return { errs };
}


/** No <img> may have failed. A lazy image that never came near the viewport
 *  (e.g. the end of the phone swipe row) is legitimately still pending; its
 *  files are covered by srcsetChecks. Eager images must have loaded. */
const imageChecks = (page) =>
  page.evaluate(() =>
    [...document.images]
      .filter((img) => (img.complete && !img.naturalWidth) || (!img.complete && img.loading !== 'lazy'))
      .map((img) => `broken img ${img.currentSrc || img.src}`),
  );

/** Every srcset candidate (AVIF + WebP, all widths) must exist on the server. */
async function srcsetChecks(page) {
  const urls = await page.evaluate(() => {
    const out = new Set();
    document.querySelectorAll('source[srcset], img[srcset]').forEach((el) =>
      el.getAttribute('srcset').split(',').forEach((c) => out.add(new URL(c.trim().split(/\s+/)[0], location.href).href)),
    );
    document.querySelectorAll('img[src]').forEach((img) => out.add(img.src));
    return [...out];
  });
  const bad = [];
  await Promise.all(
    urls.map(async (u) => {
      const r = await fetch(u, { method: 'HEAD' }).catch(() => null);
      if (!r || !r.ok) bad.push(`missing image ${u}`);
    }),
  );
  return { bad, count: urls.length };
}

const overflow = (page) =>
  page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));

/** Tile screenshots into one contact sheet, rendered by Chrome itself. */
async function contactSheet(name, shots, { cols, thumbW, title }) {
  const page = await browser.newPage();
  const cells = shots
    .map(
      (s, i) =>
        `<figure><img src="data:image/jpeg;base64,${s.b64}" width="${thumbW}"><figcaption>#${i} · y=${s.y}${s.note ? ' · ' + s.note : ''}</figcaption></figure>`,
    )
    .join('');
  await page.setViewport({ width: cols * (thumbW + 12) + 12, height: 400, deviceScaleFactor: 1 });
  await page.setContent(
    `<!doctype html><style>
      body{margin:0;padding:6px;background:#2b2b2b;font:12px/1.3 system-ui;color:#eee}
      h1{font-size:14px;margin:4px 6px 8px}
      .g{display:grid;grid-template-columns:repeat(${cols},${thumbW}px);gap:12px;padding:0 6px}
      figure{margin:0} img{display:block;height:auto;outline:1px solid #555}
      figcaption{padding-top:3px;color:#ccc}
    </style><h1>${title}</h1><div class="g">${cells}</div>`,
    { waitUntil: 'load' },
  );
  await page.screenshot({ path: resolve(SHEETS, `${name}.png`), fullPage: true });
  await page.close();
}

function record(name, problems, extra = {}) {
  results.push({ name, ok: problems.length === 0, problems, ...extra });
  const mark = problems.length ? '✗' : '✓';
  console.log(`${mark} ${name}${problems.length ? '\n    - ' + problems.slice(0, 12).join('\n    - ') : ''}`);
}

// ───────────────────────── scroll runs (motion / reduce) ─────────────────────────
async function scrollRun(lang, [w, h], mode) {
  const reduce = mode === 'reduce';
  const name = `${mode}-${lang}-${w}x${h}`;
  const { page, context, problems } = await openPage({ w, h, reduce });
  try {
    await page.goto(`${BASE}/${lang}/`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    await sleep(reduce ? 300 : 1200);

    const st = await staticChecks(page, lang);
    problems.push(...st.errs);
    for (const [k, v] of Object.entries(st.ph)) placeholders.set(k, v);
    problems.push(...(await interactionChecks(page, true)).errs);
    await sleep(700); // let the planner's pop-in / reset settle before scrolling
    // Record every story state the page passes through, not just sampled ones.
    await page.evaluate(() => {
      const s = document.querySelector('.story');
      window.__states = new Set(s.dataset.state ? [s.dataset.state] : []);
      new MutationObserver(() => s.dataset.state && window.__states.add(s.dataset.state)).observe(s, { attributes: true, attributeFilter: ['data-state'] });
    });

    // Expected story mode
    const expectPin = !reduce && (w >= 768 || h >= 680);
    const expectGalleryPin = !reduce && w >= 768;
    const env = await page.evaluate(() => ({
      pinSpacers: document.querySelectorAll('.pin-spacer').length,
      galleryPinned: document.querySelector('.pieces')?.classList.contains('is-pinned'),
      pinnedClass: document.querySelector('.story')?.classList.contains('is-pinned'),
      clones: document.querySelectorAll('.marquee-row').length,
      words: [...document.querySelectorAll('.hero-title .word')].map((e) => e.textContent),
    }));
    const wantPins = (expectPin ? 1 : 0) + (expectGalleryPin ? 1 : 0);
    if (env.pinSpacers !== wantPins) problems.push(`${env.pinSpacers} pin-spacers, expected ${wantPins}`);
    if (!!env.galleryPinned !== expectGalleryPin) problems.push(`gallery .is-pinned=${env.galleryPinned}, expected ${expectGalleryPin}`);
    if (!!env.pinnedClass !== expectPin) problems.push(`.is-pinned=${env.pinnedClass}, expected ${expectPin}`);
    if (reduce && env.clones !== 2) problems.push(`reduced motion should not clone the marquees (rows=${env.clones}, expected 2)`);
    if (!reduce && env.clones !== 4) problems.push(`both marquees should loop with 2 rows each (rows=${env.clones}, expected 4)`);
    // Sticky room cards must fit between their sticky top and the call bar,
    // otherwise their call link can never be seen; and nothing may be clipped.
    const fit = await page.evaluate((reduce) => {
      const bar = document.querySelector('.callbar');
      const barRect = bar && getComputedStyle(bar).display !== 'none' ? bar.getBoundingClientRect() : null;
      const limit = barRect ? barRect.top - 8 : window.innerHeight;
      return [...document.querySelectorAll('.room-card')].map((card, i) => {
        const inner = card.querySelector('.room-inner');
        const top = parseFloat(getComputedStyle(card).top) || 0;
        return {
          i,
          clipped: inner.scrollHeight > inner.clientHeight + 1,
          overflowsScreen: !reduce && top + card.offsetHeight > limit + 1,
          h: card.offsetHeight,
          room: Math.round(limit - top),
        };
      });
    }, reduce);
    for (const f of fit) {
      if (f.clipped) problems.push(`room card ${f.i + 1} clips its content`);
      if (f.overflowsScreen) problems.push(`room card ${f.i + 1} is ${f.h}px tall but only ${f.room}px fit when stuck`);
    }
    if (env.words.length) {
      // words-only split: every split piece is a whole word (rule 13)
      const single = env.words.filter((t) => [...t.trim()].length === 1 && /[؀-ۿ]/.test(t));
      if (single.length) problems.push(`hero title split into letters: ${single.join(' ')}`);
    }

    const shots = [];
    const states = new Set();
    let headerToggles = 0;
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    const stepPx = Math.round(h * 0.6);
    let y = 0;
    for (let i = 0; i < 80; i++) {
      const ov = await overflow(page);
      if (ov.sw !== ov.iw) problems.push(`horizontal overflow at y=${y}: scrollWidth ${ov.sw} ≠ innerWidth ${ov.iw}`);
      const snap = await page.evaluate(() => {
        const s = document.querySelector('.story');
        const caps = [...document.querySelectorAll('.story-cap')].map((c) => {
          const cs = getComputedStyle(c);
          return { o: +cs.opacity, v: cs.visibility };
        });
        return { state: s?.dataset.state, caps, y: Math.round(window.scrollY) };
      });
      if (snap.state) states.add(snap.state);
      if (!expectPin) {
        const hidden = snap.caps.filter((c) => c.o < 0.99 || c.v !== 'visible');
        if (hidden.length) problems.push(`in-flow story caption hidden at y=${snap.y}`);
      }
      shots.push({ b64: await page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 72 }), y: snap.y, note: snap.state || '' });
      if (y >= total - h) break;
      // Watch the header while the scroll + snap happens: it must not flicker.
      const watch = page.evaluate(
        () =>
          new Promise((done) => {
            const el = document.querySelector('[data-header]');
            let hidden = null;
            let flips = 0;
            const t0 = performance.now();
            const tick = () => {
              const m = new DOMMatrix(getComputedStyle(el).transform);
              const now = m.m42 < -el.offsetHeight / 2;
              if (hidden !== null && now !== hidden) flips++;
              hidden = now;
              if (performance.now() - t0 < 1800) requestAnimationFrame(tick);
              else done(flips);
            };
            tick();
          }),
      );
      await humanScroll(page, stepPx, reduce ? 250 : w >= 1024 ? 750 : 650);
      const flips = await watch;
      if (flips > 1) headerToggles++;
      y = await page.evaluate(() => window.scrollY);
      const newTotal = await page.evaluate(() => document.documentElement.scrollHeight);
      if (newTotal !== total) problems.push(`page height changed while scrolling (${total} → ${newTotal}): layout shift`);
    }
    if (headerToggles) problems.push(`header flickered (hide/show more than once in one scroll) ${headerToggles}×`);

    for (const st of await page.evaluate(() => [...window.__states])) states.add(st);
    const allStates = ['sketch', 'frame', 'upholster', 'home'];
    const missing = allStates.filter((s) => !states.has(s));
    if (missing.length) problems.push(`story never reached: ${missing.join(', ')}`);

    // Everything revealed must end visible (catches rule 2/4 blank-content bugs).
    await sleep(900);
    problems.push(...(await imageChecks(page)));
    const blank = await page.evaluate(() =>
      [...document.querySelectorAll('[data-revealed]')]
        .filter((el) => {
          const cs = getComputedStyle(el);
          return +cs.opacity < 0.99 || cs.visibility !== 'visible';
        })
        .map((el) => el.className || el.tagName),
    );
    if (blank.length) problems.push(`revealed elements still hidden at the end: ${blank.slice(0, 6).join(', ')}`);
    // The last story caption must be readable in the final state.
    const lastCap = await page.evaluate(() => {
      const c = [...document.querySelectorAll('.story-cap')].pop();
      const cs = getComputedStyle(c);
      return +cs.opacity > 0.99 && cs.visibility === 'visible';
    });
    if (!lastCap) problems.push('last story caption not visible after the story');

    const cols = w >= 1024 ? 4 : w >= 768 ? 5 : 7;
    const thumbW = w >= 1024 ? 380 : w >= 768 ? 250 : 190;
    await contactSheet(name, shots, { cols, thumbW, title: `${name} · ${shots.length} steps` });
    record(name, problems, { steps: shots.length, states: [...states] });
  } catch (e) {
    record(name, [...problems, `crashed: ${e.message}`]);
  } finally {
    await context.close().catch(() => {});
  }
}

// ───────────────────────── no-JS ─────────────────────────
async function noJsRun(lang, [w, h]) {
  const name = `nojs-${lang}-${w}x${h}`;
  const { page, context, problems } = await openPage({ w, h, js: false });
  try {
    await page.goto(`${BASE}/${lang}/`, { waitUntil: 'networkidle0' });
    const st = await staticChecks(page, lang);
    problems.push(...st.errs);
    const ov = await overflow(page);
    if (ov.sw !== ov.iw) problems.push(`horizontal overflow: scrollWidth ${ov.sw} ≠ innerWidth ${ov.iw}`);
    problems.push(...(await interactionChecks(page, false)).errs);
    problems.push(...(await imageChecks(page)));
    const sc = await srcsetChecks(page);
    problems.push(...sc.bad);
    if (sc.count < 60) problems.push(`only ${sc.count} image URLs found (expected every AVIF/WebP variant)`);
    const vis = await page.evaluate(() => {
      const bad = [];
      if (getComputedStyle(document.querySelector('.intro')).display !== 'none') bad.push('intro visible without JS');
      for (const el of document.querySelectorAll('main :is(h1,h2,h3,p,li,dt,dd,a)')) {
        if (el.closest('[aria-hidden="true"], .story-meter, [data-js-only]')) continue;
        let n = el;
        let o = 1;
        while (n && n !== document.body) {
          const cs = getComputedStyle(n);
          if (cs.display === 'none') { o = 0; break; }
          o *= +cs.opacity;
          if (cs.visibility === 'hidden') o = 0;
          n = n.parentElement;
        }
        if (o < 0.99) bad.push(`${el.tagName.toLowerCase()}.${el.className || ''} "${el.textContent.trim().slice(0, 30)}"`);
      }
      return bad;
    });
    problems.push(...vis.map((v) => `not visible without JS: ${v}`));
    const totalH = await page.evaluate(() => document.documentElement.scrollHeight);
    // rAF does not run without JS, so capture the whole page in one pass, as
    // clipped slices (one giant screenshot as a data URL crashes the sheet tab).
    const sliceH = 2400;
    const slices = [];
    for (let y = 0; y < totalH; y += sliceH) {
      const height = Math.min(sliceH, totalH - y);
      slices.push({
        b64: await page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 72, captureBeyondViewport: true, clip: { x: 0, y, width: w, height } }),
        y,
        note: `${y}–${y + height}px`,
      });
    }
    const thumbW = Math.min(w, w >= 1024 ? 300 : 200);
    await contactSheet(name, slices, { cols: Math.min(8, slices.length), thumbW, title: `${name} · full page ${totalH}px in ${slices.length} slices` });
    record(name, problems);
  } catch (e) {
    record(name, [...problems, `crashed: ${e.message}`]);
  } finally {
    await context.close().catch(() => {});
  }
}

// ───────────────────────── intro + failsafe ─────────────────────────
async function introRun(lang) {
  const name = `intro-${lang}`;
  const { page, context, problems } = await openPage({ w: 1440, h: 900, introSeen: false });
  try {
    await page.goto(`${BASE}/${lang}/`, { waitUntil: 'domcontentloaded' });
    const t = await page.evaluate(
      () =>
        new Promise((done) => {
          const t0 = performance.now();
          const fcp = () => performance.getEntriesByType('paint').find((e) => e.name === 'first-contentful-paint')?.startTime ?? 0;
          const check = () => {
            const el = document.querySelector('.intro');
            const gone = !el || getComputedStyle(el).display === 'none' || getComputedStyle(el).visibility === 'hidden';
            if (gone) done({ at: performance.now(), fcp: fcp() });
            else if (performance.now() - t0 > 4000) done({ at: -1, fcp: fcp() });
            else requestAnimationFrame(check);
          };
          check();
        }),
    );
    if (t.at < 0) problems.push('intro never lifted');
    else if (t.at - t.fcp > 1450) problems.push(`intro took ${Math.round(t.at - t.fcp)}ms after first paint (limit ~1300ms)`);
    await sleep(1500);
    const heroOk = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      return +getComputedStyle(h1).opacity === 1 && h1.getBoundingClientRect().height > 0;
    });
    if (!heroOk) problems.push('hero title not visible after the intro');
    // With the intro covering the page, the hero load-in runs and splits the
    // headline: it must be split into whole words, never letters (rule 13).
    const split = await page.evaluate(() => {
      const words = [...document.querySelectorAll('.hero-title .word')].map((w) => w.textContent.trim());
      const expected = document.querySelector('.hero-title .sr-only')?.textContent.trim().split(/\s+/) ?? [];
      return { words, expected };
    });
    if (!split.words.length) problems.push('hero load-in did not run under the intro (no split words)');
    else if (split.words.join(' ') !== split.expected.join(' ')) problems.push(`hero split mismatch: [${split.words.join('|')}] vs [${split.expected.join('|')}]`);
    record(name, problems, { liftedAfterPaintMs: Math.round(t.at - t.fcp) });
  } catch (e) {
    record(name, [...problems, `crashed: ${e.message}`]);
  } finally {
    await context.close().catch(() => {});
  }

  // Failsafe: main.js never loads → the CSS animation must still lift the cover.
  const fname = `intro-failsafe-${lang}`;
  const f = await openPage({ w: 1440, h: 900, introSeen: false, block: /\/assets\/main-.*\.js$|\/src\/js\/main\.js/ });
  try {
    await f.page.goto(`${BASE}/${lang}/`, { waitUntil: 'domcontentloaded' });
    await sleep(2000);
    const state = await f.page.evaluate(() => {
      const el = document.querySelector('.intro');
      return {
        hasIntroClass: document.documentElement.classList.contains('has-intro'),
        visibility: el ? getComputedStyle(el).visibility : 'removed',
      };
    });
    if (!state.hasIntroClass) f.problems.push('failsafe test invalid: intro was not shown');
    if (state.visibility !== 'hidden' && state.visibility !== 'removed') f.problems.push(`intro still visible 2s after load without main.js (${state.visibility})`);
    record(fname, f.problems);
  } catch (e) {
    record(fname, [...f.problems, `crashed: ${e.message}`]);
  } finally {
    await f.context.close().catch(() => {});
  }
}

// ───────────────────────── resize mid-story ─────────────────────────
async function resizeRun(lang) {
  const name = `resize-${lang}`;
  const { page, context, problems } = await openPage({ w: 1280, h: 800 });
  // Which section is at the top of the screen, plus the story state.
  const where = () =>
    page.evaluate(() => {
      const top = [...document.querySelectorAll('main > section, body > footer')].find((s) => s.getBoundingClientRect().bottom > 80);
      const story = document.querySelector('.story');
      return {
        y: Math.round(scrollY),
        section: top ? top.id || top.className : null,
        state: story.dataset.state,
        pinned: story.classList.contains('is-pinned'),
        pins: document.querySelectorAll('.pin-spacer').length,
      };
    });
  try {
    await page.goto(`${BASE}/${lang}/`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    await sleep(800);
    const shots = [];
    const shot = async (note) => shots.push({ b64: await page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 72 }), y: await page.evaluate(() => Math.round(scrollY)), note });

    // 1 · mid-story: 1280 → 800 (desktop → tablet) → 1280
    const storyTop = await page.evaluate(() => document.querySelector('[data-story-pin]').getBoundingClientRect().top + window.scrollY);
    await humanScroll(page, storyTop + 1200, 900);
    let before = await where();
    await shot(`1280 ${before.state}`);
    for (const [w, h] of [[800, 1000], [1280, 800]]) {
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
      await sleep(1400);
      const now = await where();
      await shot(`→ ${w} ${now.state}`);
      if (now.section !== before.section) problems.push(`resize to ${w} moved the reader from #${before.section} to #${now.section} (y=${now.y})`);
      if (!now.pinned || now.pins !== 2) problems.push(`after resize to ${w}: pinned=${now.pinned}, pin-spacers=${now.pins} (expected 2)`);
    }

    // 2 · below the story: the counter must still say "home" after a rebuild
    await humanScroll(page, (await page.evaluate(() => document.querySelector('#rooms').offsetTop)) - (await page.evaluate(() => scrollY)) + 400, 700);
    before = await where();
    await page.setViewport({ width: 800, height: 1000, deviceScaleFactor: 1 });
    await sleep(1400);
    let now = await where();
    await shot(`rooms → 800 ${now.state}`);
    if (now.section !== before.section) problems.push(`resize in #${before.section} moved the reader to #${now.section}`);
    if (now.state !== 'home') problems.push(`below the story after a rebuild the story state is "${now.state}", expected "home"`);

    // 3 · reload while scrolled down: same expectation
    await page.reload({ waitUntil: 'networkidle0' });
    await sleep(1200);
    now = await where();
    await shot(`reload ${now.state}`);
    if (now.state !== 'home') problems.push(`after a reload below the story the state is "${now.state}", expected "home"`);

    const ov = await overflow(page);
    if (ov.sw !== ov.iw) problems.push(`overflow after resize: ${ov.sw} ≠ ${ov.iw}`);
    await contactSheet(name, shots, { cols: 3, thumbW: 420, title: `${name}: breakpoint changes mid-page, reload mid-page` });
    record(name, problems);
  } catch (e) {
    record(name, [...problems, `crashed: ${e.message}`]);
  } finally {
    await context.close().catch(() => {});
  }
}

// ───────────────────────── run ─────────────────────────
const jobs = [];
for (const lang of LANGS) {
  for (const vp of VIEWPORTS) {
    if (MODES.includes('motion')) jobs.push(() => scrollRun(lang, vp, 'motion'));
    if (MODES.includes('reduce')) jobs.push(() => scrollRun(lang, vp, 'reduce'));
    if (MODES.includes('nojs')) jobs.push(() => noJsRun(lang, vp));
  }
  if (MODES.includes('intro')) jobs.push(() => introRun(lang));
  if (MODES.includes('resize')) jobs.push(() => resizeRun(lang));
}
const queue = [...jobs];
await Promise.all(
  Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length) await queue.shift()();
  }),
);

await browser.close();
if (server) server.kill();

const failed = results.filter((r) => !r.ok);
writeFileSync(resolve(OUT, 'report.json'), JSON.stringify({ results, placeholders: Object.fromEntries(placeholders) }, null, 2));
console.log('\n──────── summary ────────');
console.table(results.map((r) => ({ run: r.name, ok: r.ok ? 'pass' : 'FAIL', problems: r.problems.length, steps: r.steps ?? '' })));
console.log('Placeholders on the page ([data-placeholder] → count):', Object.fromEntries(placeholders));
console.log(`${results.length - failed.length}/${results.length} runs passed. Contact sheets: ${SHEETS}`);
process.exit(failed.length ? 1 : 0);
