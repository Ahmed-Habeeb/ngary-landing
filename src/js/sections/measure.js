// Measure your space: the plan's dimension lines draw one tip at a time as
// the tips scroll past (scrubbed). The plan is CSS-sticky (layout, not motion).
import { gsap, ScrollTrigger, $, $$, reveal } from '../motion.js';

export default function measure(c) {
  const section = $('.measure');
  const svg = section && $('.plan-svg', section);
  const steps = section ? $$('.m-step', section) : [];
  const list = section && $('.measure-steps', section);
  if (!svg || !list || steps.length !== 4 || c.reduce) return; // reduced/no-JS: everything drawn

  reveal($$('[data-reveal]', section));
  reveal(steps, { each: true, y: 24 });

  const q = (sel) => $$(sel, svg);
  const draws = q('.m-draw');
  const labels = q('.m-label');
  const clear = q('.m-clear');
  gsap.set(draws, { strokeDasharray: '1 2', strokeDashoffset: 1.01 });
  gsap.set(labels, { opacity: 0 });
  gsap.set(clear, { opacity: 0 });

  const tl = gsap.timeline({ defaults: { ease: 'none' } });
  // 1 · width + depth
  tl.to(q('.m-draw.m-w, .m-draw.m-d'), { strokeDashoffset: 0, duration: 0.7 }, 0.1)
    .to(q('.m-label.m-w, .m-label.m-d'), { opacity: 1, duration: 0.2 }, 0.6);
  // 2 · door + swing
  tl.to(q('.m-arc, .m-draw.m-o'), { strokeDashoffset: 0, duration: 0.7 }, 1.1)
    .to(q('.m-label.m-o'), { opacity: 1, duration: 0.2 }, 1.6);
  // 3 · room to move
  tl.to(clear, { opacity: 1, duration: 0.6 }, 2.1);
  // 4 · height
  tl.to(q('.m-draw.m-h'), { strokeDashoffset: 0, duration: 0.7 }, 3.1)
    .to(q('.m-label.m-h'), { opacity: 1, duration: 0.2 }, 3.6)
    .to({}, { duration: 0.2 }, 3.8); // settle

  let active = -1;
  const sync = (self) => {
    const i = Math.min(3, Math.floor(self.progress * 4));
    if (i === active) return;
    active = i;
    steps.forEach((s, n) => s.classList.toggle('is-active', n === i));
  };
  ScrollTrigger.create({
    animation: tl,
    trigger: list,
    start: 'top 70%',
    end: 'bottom 60%',
    scrub: 0.6,
    onUpdate: sync,
    onRefresh: sync,
  });

  return () => steps.forEach((s) => s.classList.remove('is-active'));
}
