// Story: the armchair is built step by step, scrubbed by scroll.
//   start → sketch → frame → upholster → home
// Each label sits at the SETTLED end of its step (labelsDirectional snaps only
// to labels, and the last label is at progress 1 so snap can reach the end).
import { gsap, ScrollTrigger, $, $$, reveal } from '../motion.js';

// Label names as constants: a typo in seek() would silently add a stray label.
const START = 'start';
const STEPS = ['sketch', 'frame', 'upholster', 'home'];
// Times at which the caption/counter switch to the next step (just after a label).
const SWITCH = [1.35, 2.35, 3.35];
const stepAt = (t) => (t < SWITCH[0] ? 0 : t < SWITCH[1] ? 1 : t < SWITCH[2] ? 2 : 3);

export default function story(c) {
  const section = $('.story');
  if (!section) return;
  const pinEl = $('[data-story-pin]', section);
  const stage = $('.story-stage', section);
  const svg = stage && $('.stage-svg', stage);
  const caps = $$('.story-cap', section);
  const night = stage && $('.stage-night', stage);
  if (!pinEl || !svg || !night || caps.length !== STEPS.length) return;

  const count = $('[data-story-count]', section);
  const fill = $('[data-story-fill]', section);
  const q = (sel) => $$(sel, svg);
  const grid = q('.s-grid');
  const sketch = q('.s-sketch');
  const lines = q('.s-line:not(.s-guide)');
  const guides = q('.s-guide');
  const dims = q('.s-dims');
  const shadow = q('.s-shadow');
  const parts = q('.s-part');
  const cushions = q('.s-cushion');
  const swatchGroup = q('.s-swatches');
  const swatches = q('.s-swatch');
  const pick = q('.s-pick');
  const rug = q('.s-rug');
  const props = q('.s-prop');
  const light = q('.s-light');

  if (!c.reduce) reveal($$('.story-head [data-reveal]', section));

  // Pin only when the scene fits: always on tablet/desktop, on phones only if
  // the viewport is tall enough. Reduced motion never pins.
  const pinned = !c.reduce && (c.desktop || c.tablet || (c.mobile && window.innerHeight >= 680));
  if (pinned) section.classList.add('is-pinned');

  // ── "Before" states, set by GSAP before the timeline is built (rules 1, 5).
  // The markup is authored in the finished state for the no-JS page.
  gsap.set([...grid, ...sketch, ...swatchGroup], { opacity: 1 });
  // The pin opens on a blueprint page: grid, guides and the "made to your
  // size" dimension are already there; the chair outline is not.
  gsap.set(guides, { strokeDasharray: 'none', strokeDashoffset: 0 });
  gsap.set(lines, { strokeDasharray: '1 2', strokeDashoffset: 1.01 });
  gsap.set(dims, { opacity: 1 });
  gsap.set(shadow, { opacity: 0, scaleX: 0.6, transformOrigin: '50% 50%' });
  gsap.set(parts, { autoAlpha: 0, y: 26 });
  gsap.set(cushions, { autoAlpha: 0, scaleY: 0.2, transformOrigin: '50% 100%' });
  // The picked swatch wraps an animated ring, so swatches fade with opacity (rule 2).
  gsap.set(swatches, { opacity: 0, rotation: 0, scale: 1, transformOrigin: '50% 100%' });
  gsap.set(pick, { opacity: 0 });
  gsap.set(rug, { scaleX: 0, transformOrigin: '50% 50%' });
  gsap.set(props, { autoAlpha: 0, y: 20 });
  gsap.set(light, { opacity: 0 });
  gsap.set(night, { opacity: 0 });
  if (fill) gsap.set(fill, { scaleX: 0 });
  // Only the pinned layout cross-fades captions. In-flow captions (reduced
  // motion, short phones) must never be hidden while someone is reading them.
  if (pinned) gsap.set(caps.slice(1), { autoAlpha: 0, y: 30 });

  const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' }, paused: c.reduce });
  tl.addLabel(START, 0);

  // 1 · sketch (0 → 1): the pencil outline of every part draws in
  tl.to(lines, { strokeDashoffset: 0, duration: 0.75, stagger: 0.025 }, 0.05)
    .addLabel(STEPS[0], 1);

  // 2 · frame (1 → 2): the walnut parts rise in, the sketch dims
  tl.fromTo(dims, { opacity: 1 }, { opacity: 0, duration: 0.3, immediateRender: false }, 1.05)
    .fromTo(sketch, { opacity: 1 }, { opacity: 0.25, duration: 0.5, immediateRender: false }, 1.15)
    .to(parts, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.1, ease: 'power3.out' }, 1.1)
    .to(shadow, { opacity: 0.18, scaleX: 1, duration: 0.6 }, 1.3)
    .addLabel(STEPS[1], 2);

  // 3 · upholster (2 → 3): swatches fan out, plum is picked, cushions grow from their base
  tl.to(swatches, { opacity: 1, duration: 0.2, stagger: 0.05 }, 2.05)
    .to(swatches[0], { rotation: -24, duration: 0.35 }, 2.1)
    .to(swatches[2], { rotation: 24, duration: 0.35 }, 2.1)
    .to(swatches[2], { scale: 1.1, duration: 0.2 }, 2.42)
    .to(pick, { opacity: 1, duration: 0.15 }, 2.42)
    .to(cushions, { autoAlpha: 1, scaleY: 1, duration: 0.4, stagger: 0.08, ease: 'back.out(1.4)' }, 2.42)
    .fromTo(sketch, { opacity: 0.25 }, { opacity: 0, duration: 0.4, immediateRender: false }, 2.5)
    .fromTo(grid, { opacity: 1 }, { opacity: 0, duration: 0.4, immediateRender: false }, 2.5)
    .addLabel(STEPS[2], 3);

  // 4 · home (3 → 4): swatches leave, evening falls, the room assembles around it
  tl.fromTo(swatches, { opacity: 1 }, { opacity: 0, duration: 0.25, stagger: 0.04, immediateRender: false }, 3.05)
    .to(night, { opacity: 1, duration: 0.6 }, 3.1)
    .to(rug, { scaleX: 1, duration: 0.5, ease: 'power3.out' }, 3.2)
    .to(props, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.1, ease: 'power3.out' }, 3.35)
    .to(light, { opacity: 0.5, duration: 0.35 }, 3.6)
    .addLabel(STEPS[3], 4);

  // Progress bar spans the whole timeline (direction-aware origin is in CSS).
  if (fill) tl.to(fill, { scaleX: 1, duration: 4, ease: 'none' }, 0);

  // Caption cross-fades, pinned layout only. Fade-outs use explicit fromTo +
  // immediateRender:false so scrubbing backwards restores them (rule 2).
  if (pinned) {
    SWITCH.forEach((t, i) => {
      tl.fromTo(caps[i], { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -30, duration: 0.3, immediateRender: false }, t - 0.3)
        .to(caps[i + 1], { autoAlpha: 1, y: 0, duration: 0.35 }, t);
    });
  }

  // Step counter + state attribute, written only when the step changes.
  let current = -1;
  const sync = () => {
    const i = stepAt(tl.time());
    if (i === current) return;
    current = i;
    if (count) count.textContent = String(i + 1).padStart(2, '0');
    section.dataset.state = STEPS[i];
    caps.forEach((cap, n) => cap.classList.toggle('is-active', n === i));
  };
  tl.eventCallback('onUpdate', sync);

  if (pinned) {
    const length = c.desktop ? 3.5 : c.tablet ? 3 : 2.2;
    ScrollTrigger.create({
      animation: tl,
      trigger: pinEl,
      start: 'top top',
      end: () => '+=' + Math.round(window.innerHeight * length),
      pin: true,
      scrub: 0.6,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      // A refresh (reload mid-page, breakpoint change) renders the timeline
      // with callbacks suppressed, so sync the counter from the trigger too.
      onRefresh: sync,
      onUpdate: sync,
      snap: c.desktop
        ? // inertia:false → always the NEXT step in the scroll direction; a fast
          // flick must not skip a chapter of the story.
          { snapTo: 'labelsDirectional', inertia: false, duration: { min: 0.2, max: 0.6 }, delay: 0.1, ease: 'power1.inOut' }
        : undefined,
    });
  } else if (!c.reduce) {
    // Short phones: no pin. The CSS-sticky stage scrubs while the in-flow
    // captions scroll past underneath it.
    ScrollTrigger.create({
      animation: tl,
      trigger: $('.story-captions', section),
      start: 'top 70%',
      end: 'bottom 70%',
      scrub: 0.6,
      onRefresh: sync,
      onUpdate: sync,
    });
  } else {
    // Reduced motion: no scrubbing. Jump instantly to each step's settled
    // label as its caption becomes the one being read.
    const go = (i) => {
      tl.seek(STEPS[i]);
      sync(); // seek() suppresses callbacks
    };
    go(0);
    caps.forEach((cap, i) => {
      ScrollTrigger.create({
        trigger: cap,
        start: 'top 65%',
        end: 'bottom 65%',
        onToggle(self) {
          if (self.isActive) go(i);
        },
      });
    });
  }
  sync();

  return () => {
    section.classList.remove('is-pinned');
    delete section.dataset.state;
    caps.forEach((cap) => cap.classList.remove('is-active'));
    if (count) count.textContent = '01';
  };
}
