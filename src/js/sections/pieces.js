// Pieces: a horizontal gallery. Tablet/desktop pin the section and scrub the
// track sideways (in the reading direction); phones keep the native swipe
// row; reduced motion and no-JS keep the static layout.
import { gsap, ScrollTrigger, $, $$, reveal, dirSign } from '../motion.js';

export default function pieces(c) {
  const section = $('.pieces');
  if (!section) return;
  const pinEl = $('[data-pieces-pin]', section);
  const viewport = $('[data-pieces-viewport]', section);
  const track = $('[data-pieces-track]', section);
  const fill = $('[data-pieces-fill]', section);
  const cards = $$('.piece-card', section);
  if (c.reduce || !track || !viewport || !pinEl) return;

  reveal($$('[data-reveal]', section));

  if (c.mobile) {
    // native swipe row: just let the first cards arrive
    reveal(cards.slice(0, 3), { stagger: 0.1, trigger: track });
    return;
  }

  section.classList.add('is-pinned');
  // How far the track must travel: its content width minus the visible inner
  // width. scrollWidth/clientWidth, not getBoundingClientRect (rule 6).
  const distance = () => {
    const cs = getComputedStyle(viewport);
    const inner = viewport.clientWidth - parseFloat(cs.paddingInlineStart) - parseFloat(cs.paddingInlineEnd);
    return Math.max(0, track.scrollWidth - inner);
  };

  reveal(cards.slice(0, 4), { stagger: 0.08, trigger: track, start: 'top 90%' });
  if (fill) gsap.set(fill, { scaleX: 0 });

  const tl = gsap.timeline({ defaults: { ease: 'none' } });
  tl.to(track, { x: () => distance() * dirSign(), duration: 1 }, 0);
  if (fill) tl.to(fill, { scaleX: 1, duration: 1 }, 0);

  ScrollTrigger.create({
    animation: tl,
    trigger: pinEl,
    start: 'top top',
    end: () => '+=' + distance(),
    pin: true,
    scrub: 0.6,
    anticipatePin: 1,
    invalidateOnRefresh: true,
  });

  return () => section.classList.remove('is-pinned');
}
