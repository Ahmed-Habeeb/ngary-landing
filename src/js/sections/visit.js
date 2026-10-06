// Visit: a slow "camera" settles onto the illustrated map; the pin drops in.
import { gsap, $, $$, reveal } from '../motion.js';

export default function visit(c) {
  const section = $('.visit');
  if (!section || c.reduce) return;
  reveal($$('[data-reveal]', section), { stagger: 0.07 });

  const photo = $('[data-visit-photo]', section);
  if (photo) {
    gsap.fromTo(
      photo,
      { yPercent: c.mobile ? -3 : -6 },
      { yPercent: c.mobile ? 3 : 6, ease: 'none', scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true } },
    );
  }

  const cam = $('[data-map-cam]', section);
  const pin = $('.map-pin', section);
  const roads = $('.map-roads', section);
  if (!cam) return;

  gsap.fromTo(
    cam,
    { scale: c.mobile ? 1.1 : 1.22 },
    { scale: 1, ease: 'none', scrollTrigger: { trigger: section, start: 'top bottom', end: 'center center', scrub: true } },
  );
  if (roads && !c.mobile) {
    gsap.fromTo(
      roads,
      { y: 14 },
      { y: -14, ease: 'none', scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true } },
    );
  }
  if (pin) {
    gsap.set(pin, { autoAlpha: 0, y: -60 });
    gsap.to(pin, {
      autoAlpha: 1,
      y: 0,
      duration: 0.9,
      ease: 'bounce.out',
      scrollTrigger: { trigger: cam, start: 'top 65%', once: true },
    });
  }
}
