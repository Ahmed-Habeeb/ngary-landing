// Header: solid background after 80px (class toggle → CSS opacity on a
// separate layer), hide on scroll-down / show on scroll-up.
import { gsap, ScrollTrigger, $ } from '../motion.js';

export default function header(c) {
  const el = $('[data-header]');
  if (!el) return;

  ScrollTrigger.create({
    start: 80,
    end: 'max',
    onToggle(self) {
      el.classList.toggle('is-scrolled', self.isActive);
    },
  });

  if (c.reduce) {
    return () => el.classList.remove('is-scrolled');
  }

  // ONE paused tween, played/reversed — never a new tween per onUpdate.
  const hide = gsap.to(el, { yPercent: -100, duration: 0.35, ease: 'power2.out', paused: true });
  let lastY = window.scrollY;
  let travel = 0;
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate(self) {
      const y = self.scroll();
      const d = y - lastY;
      lastY = y;
      if (y < 160) {
        travel = 0;
        hide.reverse();
        return;
      }
      // Accumulate same-direction travel; a 12px threshold ignores the tiny
      // reversals of snap's programmatic scrolling (no flicker).
      travel = Math.sign(d) === Math.sign(travel) ? travel + d : d;
      if (travel > 12) hide.play();
      else if (travel < -12) hide.reverse();
    },
  });

  // Keyboard users must always see where focus is.
  const onFocus = () => hide.reverse();
  el.addEventListener('focusin', onFocus);

  return () => {
    el.removeEventListener('focusin', onFocus);
    el.classList.remove('is-scrolled');
  };
}
