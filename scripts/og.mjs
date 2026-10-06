// Renders the 1200×630 Open Graph cards (Ngary's logo + headline) into public/og/. Social scrapers need a raster file,
// so these PNGs are the only raster images in the project.
// Usage: npm run og   (needs `npm run preview` running for the font + chair)
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.URL || 'http://localhost:4173';
const CARDS = {
  ar: { dir: 'rtl', title: 'أثاث يُصنع لبيتك', sub: 'نجاري · معرض · تفصيل حسب الطلب · توصيل' },
  en: { dir: 'ltr', title: 'Furniture made for your home', sub: 'Ngary · Showroom · Custom orders · Delivery' },
};

mkdirSync('public/og', { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });

for (const [lang, c] of Object.entries(CARDS)) {
  // Load the real page so the self-hosted font and the chair <symbol> are available.
  await page.goto(`${BASE}/${lang}/`, { waitUntil: 'networkidle0' });
  await page.evaluate((c) => {
    const sprite = document.querySelector('.sprite').outerHTML;
    document.documentElement.className = '';
    document.body.innerHTML = `${sprite}
      <div style="position:fixed;inset:0;display:grid;grid-template-columns:1.1fr .9fr;align-items:center;gap:40px;padding:0 80px;background:#22122E;color:#FAF6F0;direction:${c.dir}">
        <div>
          <p style="margin:0 0 18px;font-size:23px;font-weight:600;color:#C8986A;white-space:nowrap">${c.sub}</p>
          <p style="margin:0;font-size:84px;line-height:1.15;font-weight:650">${c.title}</p>
        </div>
        <div style="position:relative;height:460px;display:grid;place-items:center">
          <div style="position:absolute;inset:10px 40px;border-radius:999px 999px 24px 24px;background:#2E1A3D"></div>
          <img src="/brand/logo-640.webp" style="position:relative;width:380px;height:380px;border-radius:50%">
        </div>
      </div>`;
  }, c);
  await page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode().catch(() => {}))]));
  await page.screenshot({ path: `public/og/og-${lang}.png` });
  console.log(`public/og/og-${lang}.png`);
}
await browser.close();
