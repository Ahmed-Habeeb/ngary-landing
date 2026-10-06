// Kinetic marquee band(s): an endless loop in the reading direction (or the
// opposite one with data-marquee-reverse), plus a skew driven by scroll
// velocity. Loop and skew live on separate elements (rule 3).
// Exported as a factory so main.js can call each band at its own place in
// page order (the second band sits below the pinned gallery).
import { gsap, ScrollTrigger, $, dirSign } from '../motion.js';

export const marqueeAt = (selector) =>
  function marquee(c) {
    const section = $(selector);
    const track = section && $('[data-marquee-track]', section);
    const skewEl = section && $('[data-marquee-skew]', section);
    const row = track && $('.marquee-row', track);
    // Reduced motion: static, wrapped words. No-JS shows the same.
    if (!row || !skewEl || c.reduce) return;

    // The second copy only exists while looping, so assistive tech, no-JS and
    // reduced motion all get the words once.
    const clone = row.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    track.append(clone);
    section.classList.add('is-looping');

    // Two identical copies in a max-content track: moving by 50% is seamless.
    // dirSign(): LTR moves left (−50%), RTL moves right (+50%). A reversed
    // band travels from the shifted position back to 0 instead.
    const shift = 50 * dirSign();
    const reverse = section.hasAttribute('data-marquee-reverse');
    const loop = gsap.fromTo(
      track,
      { xPercent: reverse ? shift : 0 },
      { xPercent: reverse ? 0 : shift, duration: c.mobile ? 26 : 38, ease: 'none', repeat: -1, paused: true },
    );

    const skewTo = gsap.quickTo(skewEl, 'skewX', { duration: 0.6, ease: 'power3.out' });
    const clamp = gsap.utils.clamp(-10, 10);
    const strength = c.mobile ? 600 : 300;

    ScrollTrigger.create({
      trigger: section,
      start: 'top bottom',
      end: 'bottom top',
      // Rule 11: the loop only runs while the band is on screen.
      onToggle(self) {
        if (self.isActive) loop.play();
        else loop.pause();
      },
      onUpdate(self) {
        skewTo(clamp(self.getVelocity() / strength) * dirSign());
      },
    });
    const settle = () => skewTo(0);
    ScrollTrigger.addEventListener('scrollEnd', settle);

    return () => {
      ScrollTrigger.removeEventListener('scrollEnd', settle);
      clone.remove();
      section.classList.remove('is-looping');
    };
  };
