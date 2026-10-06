// Final call: the lamp comes on as you arrive; magnetic call button.
import { gsap, $, $$, reveal, magnetic } from '../motion.js';

export default function cta(c) {
  const section = $('.final');
  if (!section || c.reduce) return;
  reveal($$('[data-reveal]', section), { stagger: 0.08 });

  // The button's wrapper has an animated (magnetic) child: opacity, not autoAlpha (rule 2).
  const wrap = $('[data-final-cta]', section);
  if (wrap) {
    gsap.set(wrap, { opacity: 0, y: 20 });
    gsap.to(wrap, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: wrap, start: 'top 92%', once: true } });
  }

  const glow = $('.cta-glow', section);
  const light = $('.cta-light', section);
  const lamp = { trigger: section, start: 'top 75%', end: 'center center', scrub: true };
  if (glow) gsap.fromTo(glow, { opacity: 0 }, { opacity: 1, ease: 'none', scrollTrigger: lamp });
  if (light) gsap.fromTo(light, { opacity: 0 }, { opacity: 0.45, ease: 'none', scrollTrigger: { ...lamp } });

  return magnetic($('[data-magnetic]', section));
}
