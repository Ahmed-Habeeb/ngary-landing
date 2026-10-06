// Why Ngary: four bento tiles with photos. Tiles fade up as they arrive;
// each photo drifts slightly inside its frame while it crosses the screen.
import { gsap, $, $$, reveal } from '../motion.js';

export default function why(c) {
  const section = $('.why');
  if (!section || c.reduce) return;
  reveal($$('[data-reveal]', section));
  // tiles wrap animated photos: fade them with opacity (rule 2)
  reveal($$('.why-tile', section), { each: true, y: 40, fade: 'opacity' });

  const amp = c.desktop ? 7 : 4; // yPercent of the (taller) photo layer
  $$('.why-tile', section).forEach((tile) => {
    const photo = $('[data-why-photo]', tile);
    if (!photo) return;
    gsap.fromTo(
      photo,
      { yPercent: -amp, scale: 1.08 },
      { yPercent: amp, scale: 1, ease: 'none', scrollTrigger: { trigger: tile, start: 'top bottom', end: 'bottom top', scrub: true } },
    );
  });
}
