// One-time brand intro (≤1.3s). Runs once, outside gsap.matchMedia, so a
// breakpoint change can never replay it. Failsafes: the CSS animation in
// main.css hides the cover at 1.6s even if this file never loads, and a
// timeout here lifts it even if a tween stalls.
import { gsap, $ } from './motion.js';

let resolveDone;
/** Resolves when the cover starts lifting (true) or immediately if there is none (false). */
export const introDone = new Promise((r) => (resolveDone = r));

let covering = false;
/** True while the cover hides the page, so the hero can set hidden states without a flash. */
export const introCovering = () => covering;

export function runIntro() {
  const root = document.documentElement;
  const el = $('.intro');
  if (!el || !root.classList.contains('has-intro')) {
    resolveDone(false);
    return;
  }
  covering = true;

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    covering = false;
    root.classList.remove('has-intro');
    el.remove();
  };
  // Hard failsafe in JS too (the CSS one fires at 1.6s).
  const failsafe = setTimeout(() => {
    resolveDone(true);
    finish();
  }, 1500);

  // If the module arrived late (slow network), don't make people wait for
  // the full sequence: lift the cover quickly instead.
  const late = performance.now() > 1100;
  const line = $('.intro-line', el);
  const word = $('.intro-word', el);
  const badge = $('.intro-logo', el);

  const tl = gsap.timeline({
    onComplete() {
      clearTimeout(failsafe);
      finish();
    },
  });
  if (!late && line && word && badge) {
    // the ring draws around the badge while the badge settles in
    gsap.set(line, { strokeDasharray: '1 2', strokeDashoffset: 1.01 });
    gsap.set(badge, { autoAlpha: 0, scale: 0.86 });
    gsap.set(word, { autoAlpha: 0, y: 16 });
    tl.to(line, { strokeDashoffset: 0, duration: 0.65, ease: 'power2.inOut' }, 0)
      .to(badge, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'back.out(1.6)' }, 0.05)
      .to(word, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power3.out' }, 0.3);
  }
  const liftAt = late ? 0 : 0.8;
  tl.call(() => resolveDone(true), null, liftAt)
    .to(el, { yPercent: -100, duration: late ? 0.3 : 0.45, ease: 'power3.inOut' }, liftAt);
  // total: 0.8 + 0.45 = 1.25s
}
