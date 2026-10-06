// Dev helper: quick screenshots of one language/viewport against `npm run preview`.
// Usage: node scripts/shot.mjs <ar|en> <width> <height> <js:1|0>
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
const OUT = process.env.SHOT_DIR || 'verify-output/shots-quick';
mkdirSync(OUT, { recursive: true });
const [lang='ar', w='1440', h='900', js='1'] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage();
const logs = [];
page.on('console', m => logs.push(m.type() + ': ' + m.text()));
page.on('pageerror', e => logs.push('pageerror: ' + e.message));
await page.setViewport({ width: +w, height: +h });
if (js === '0') await page.setJavaScriptEnabled(false);
await page.evaluateOnNewDocument(() => { try { sessionStorage.setItem('nagary:intro', '1'); } catch (e) {} });
await page.goto(`http://localhost:4173/${lang}/`, { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 1500));
if (js === '0') {
  await page.screenshot({ path: `${OUT}/${lang}-${w}-nojs.png`, fullPage: true });
} else {
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  let i = 0;
  for (let y = 0; y < H; y += Math.round(+h * 0.9)) {
    await page.evaluate(y => window.scrollTo(0, y), y);
    await new Promise(r => setTimeout(r, 900));
    await page.screenshot({ path: `${OUT}/${lang}-${w}-${String(i++).padStart(2, '0')}.png` });
  }
}
console.log(logs.join('\n') || 'no console output');
await browser.close();
