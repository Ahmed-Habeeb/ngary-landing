// Rooms: CSS-sticky cards stack on top of each other; JS only adds the
// depth (the card underneath shrinks and dims) and a light art parallax.
import { gsap, $, $$, reveal } from '../motion.js';

export default function rooms(c) {
  const section = $('.rooms');
  if (!section) return;
  const cards = $$('.room-card', section);
  const marks = $$('.room-mark', section);
  // Reduced motion: no reveals, and sticky stacking is switched off in CSS.
  if (c.reduce) return;
  reveal($$('[data-reveal]', section));
  if (!cards.length || marks.length !== cards.length) return;

  // Where a card sticks, read from CSS so the numbers stay in one place.
  const stickTop = (card) => parseFloat(getComputedStyle(card).top) || 0;

  cards.forEach((card, i) => {
    const inner = $('.room-inner', card);
    const dim = $('.card-dim', card);
    const art = $('[data-room-art]', card);
    const nextMark = marks[i + 1];
    const nextCard = cards[i + 1];

    // The card underneath recedes while the next one slides over it.
    // Triggers are the never-sticky sentinels, so measurements survive a
    // refresh mid-scroll (rule 6).
    if (inner && dim && nextMark && nextCard) {
      gsap.timeline({
        scrollTrigger: {
          trigger: nextMark,
          start: 'top bottom',
          end: () => `top ${stickTop(nextCard)}px`,
          scrub: true,
          invalidateOnRefresh: true,
        },
      })
        .to(inner, { scale: c.mobile ? 0.95 : 0.92, ease: 'none' }, 0)
        .to(dim, { opacity: 0.5, ease: 'none' }, 0);
    }

    // Light parallax on the art while the card travels to its sticky spot.
    if (art && !c.mobile) {
      gsap.fromTo(
        art,
        { y: c.desktop ? 36 : 20 },
        {
          y: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: marks[i],
            start: 'top bottom',
            end: () => `top ${stickTop(card)}px`,
            scrub: true,
            invalidateOnRefresh: true,
          },
        },
      );
    }
  });
}
