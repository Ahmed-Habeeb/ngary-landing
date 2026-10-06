// How it works: a hand-drawn line draws itself with scroll (desktop), or a
// vertical rail fills (tablet/mobile). Steps reveal as they arrive.
import { gsap, $, $$, reveal, dirSign } from '../motion.js';

export default function process(c) {
  const section = $('.how');
  if (!section) return;
  const svg = $('.how-line', section);
  const path = svg && $('.how-path', svg);
  const nodes = svg ? $$('.how-node', svg) : [];
  const rail = $('.how-rail-fill', section);
  const steps = $$('.how-step', section);

  // RTL: step 1 sits on the right, so mirror the line. Done through GSAP,
  // never a CSS transform, because GSAP owns transform here (rule 10).
  if (c.desktop || (c.reduce && window.innerWidth >= 1024)) {
    if (svg && dirSign() > 0) gsap.set(svg, { scaleX: -1 });
  }
  if (c.reduce) return; // fully drawn, everything visible

  reveal($$('[data-reveal]', section));

  if (c.desktop && path) {
    gsap.set(path, { strokeDasharray: '1 2', strokeDashoffset: 1.01 });
    if (nodes.length) gsap.set(nodes, { scale: 0, transformOrigin: '50% 50%' });
    const tl = gsap.timeline({
      scrollTrigger: { trigger: svg, start: 'top 80%', end: 'bottom 35%', scrub: 0.6 },
    });
    tl.to(path, { strokeDashoffset: 0, ease: 'none', duration: 1 }, 0);
    // Each node pops as the line reaches it (nodes sit at 9%, 35%, 61%, 88% of the path).
    nodes.forEach((n, i) => tl.to(n, { scale: 1, duration: 0.08, ease: 'back.out(2.5)' }, [0.05, 0.33, 0.6, 0.87][i] ?? 0.9));
    reveal(steps, { stagger: 0.12 });
  } else {
    if (rail) {
      gsap.set(rail, { scaleY: 0 });
      gsap.to(rail, {
        scaleY: 1,
        ease: 'none',
        scrollTrigger: { trigger: $('.how-steps', section), start: 'top 70%', end: 'bottom 70%', scrub: 0.6 },
      });
    }
    // One trigger per step on narrow screens: they arrive one by one.
    reveal(steps, { each: true });
  }
}
