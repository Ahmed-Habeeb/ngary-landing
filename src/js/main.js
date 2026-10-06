// Entry. One gsap.matchMedia() drives every section; each module returns
// its own cleanup. Modules are called IN PAGE ORDER: ScrollTrigger measures
// triggers in creation order, so everything below the story pin must be
// created after that pin.
import { gsap, ScrollTrigger, $$ } from './motion.js';
import { runIntro } from './intro.js';
import header from './sections/header.js';
import hero from './sections/hero.js';
import story from './sections/story.js';
import { marqueeAt } from './sections/marquee.js';
import why from './sections/why.js';
import rooms from './sections/rooms.js';
import pieces from './sections/pieces.js';
import designer from './sections/designer.js';
import process from './sections/process.js';
import measure from './sections/measure.js';
import visit from './sections/visit.js';
import faq from './sections/faq.js';
import cta from './sections/cta.js';

// Exactly the order of the page: two pins (story, pieces), and every trigger
// below a pin must be created after it.
const sections = [
  header,
  hero,
  story, // pin 1
  marqueeAt('.marquee:not(.marquee--alt)'),
  why,
  rooms,
  pieces, // pin 2
  designer,
  process,
  measure,
  visit,
  marqueeAt('.marquee--alt'),
  faq,
  cta,
];

// Once per page view, never inside matchMedia (a breakpoint change must not replay it).
runIntro();

const CONDITIONS = {
  desktop: '(min-width: 1024px) and (prefers-reduced-motion: no-preference)',
  tablet: '(min-width: 768px) and (max-width: 1023.98px) and (prefers-reduced-motion: no-preference)',
  mobile: '(max-width: 767.98px) and (prefers-reduced-motion: no-preference)',
  reduce: '(prefers-reduced-motion: reduce)',
};

// Keep the reader's place across a breakpoint change. gsap.matchMedia rebuilds
// every ScrollTrigger; the new triggers refresh on creation, which clears
// ScrollTrigger's remembered scroll position, so the page would land at the
// top. We remember which section is at the top of the screen and how far
// through it on every `resize` (the browser fires resize BEFORE media-query
// change events), and return there once ScrollTrigger has finished its
// post-matchMedia refresh. Proportional, because pin lengths differ per
// breakpoint. offsetTop/offsetHeight, not getBoundingClientRect (rule 6).
let place = null;
const docTop = (el) => {
  let y = 0;
  for (let n = el; n; n = n.offsetParent) y += n.offsetTop;
  return y;
};
const rememberPlace = () => {
  const y = window.scrollY;
  const el = Array.from(document.querySelectorAll('main > section, body > footer')).find(
    (s) => docTop(s) + s.offsetHeight > y,
  );
  place = el ? { el, frac: (y - docTop(el)) / Math.max(1, el.offsetHeight) } : null;
};
window.addEventListener('resize', rememberPlace, { passive: true });
ScrollTrigger.addEventListener('matchMedia', () => {
  if (!place) return;
  const { el, frac } = place;
  place = null;
  window.scrollTo(0, Math.round(docTop(el) + frac * el.offsetHeight));
  ScrollTrigger.update();
});

const mm = gsap.matchMedia();
mm.add(
  CONDITIONS,
  (context, contextSafe) => {
    const { conditions } = context;
    const cleanups = [];
    for (const section of sections) {
      const cleanup = section(conditions, contextSafe);
      if (typeof cleanup === 'function') cleanups.push(cleanup);
    }
    // GSAP reverts every tween/ScrollTrigger/pin of this context first, then
    // calls this: undo DOM changes the modules made (classes, clones, splits).
    return () => {
      cleanups.reverse().forEach((fn) => fn());
      $$('[data-revealed]').forEach((el) => el.removeAttribute('data-revealed'));
    };
  },
);

// Readex Pro swaps in after first layout; re-measure once it has.
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => ScrollTrigger.refresh());
}
