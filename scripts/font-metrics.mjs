// Measures Readex Pro against its local fallbacks with canvas measureText and
// prints the @font-face overrides used in src/css/main.css (no extra packages).
// Needs `npm run preview` running (the font is served from the build).
// Usage: node scripts/font-metrics.mjs
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.env.URL || 'http://localhost:4173/en/';

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
await page.goto(URL, { waitUntil: 'networkidle0' });

const result = await page.evaluate(async () => {
  const LATIN = 'The quick brown fox jumps over the lazy dog 0123456789 Ngary furniture, made for your home.';
  const ARABIC = 'أثاث يُصنع لبيتك من رسمة على الورق إلى غرفة معيشتك نجاري للأثاث اتصل بنا الآن';
  await document.fonts.load('100px "Readex Pro Variable"', LATIN);
  await document.fonts.load('100px "Readex Pro Variable"', ARABIC);
  const ctx = document.createElement('canvas').getContext('2d');
  const m = (family, text) => {
    ctx.font = `400 100px ${family}`;
    const t = ctx.measureText(text);
    return { width: t.width, ascent: t.fontBoundingBoxAscent, descent: t.fontBoundingBoxDescent };
  };
  const face = (target, fallback, text) => {
    const r = m('"Readex Pro Variable"', text);
    const f = m(fallback, text);
    const size = r.width / f.width;
    // Overrides are applied after size-adjust, so divide it back out.
    return {
      fallback,
      sizeAdjust: +(size * 100).toFixed(1),
      ascentOverride: +((r.ascent / 100 / size) * 100).toFixed(1),
      descentOverride: +((r.descent / 100 / size) * 100).toFixed(1),
    };
  };
  return {
    latin: face('latin', 'Arial', LATIN),
    arabic: face('arabic', '"Geeza Pro"', ARABIC),
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close();
