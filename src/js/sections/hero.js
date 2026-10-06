// Hero: staggered load-in, idle float, pointer tilt/parallax, scroll pose.
// Each motion owns its own wrapper (rule 3):
//   .chair-load (load-in) › .chair-float (idle y) › .chair-tilt (rotationX/Y) › .chair-scroll (scroll pose)
import { gsap, ScrollTrigger, $, $$, splitWords, magnetic, finePointer, hasPainted } from '../motion.js';
import { introDone, introCovering } from '../intro.js';

let loadInDone = false; // the load-in plays once per page view, not per breakpoint

export default function hero(c, contextSafe) {
  const section = $('.hero');
  if (!section) return;
  const title = $('.hero-title', section);
  const fades = $$('[data-hero-fade]', section);
  const ctas = $$('[data-hero-cta]', section);
  const copy = $('[data-hero-copy]', section);
  const arch = $('.hero-arch', section);
  const load = $('.chair-load', section);
  const float = $('.chair-float', section);
  const tilt = $('.chair-tilt', section);
  const pose = $('.chair-scroll', section);
  const swatches = $$('[data-swatch]', section).filter((s) => getComputedStyle(s).display !== 'none');
  const cleanups = [];

  // Reduced motion: the hero stays exactly as rendered. No float, tilt or parallax.
  if (c.reduce) return;

  // ── Load-in. Only when nothing has been seen yet: either the intro cover
  // is still up, or the browser hasn't painted. Otherwise skipping it is
  // better than flashing visible → hidden → visible.
  if (!loadInDone && title && (introCovering() || !hasPainted())) {
    loadInDone = true;
    const split = splitWords(title);
    cleanups.push(split.revert);

    gsap.set(split.words, { yPercent: 110 });
    gsap.set(fades, { autoAlpha: 0, y: 18 }); // leaf elements
    // Wrappers with animated children: opacity, never autoAlpha (rule 2).
    gsap.set(ctas, { opacity: 0, y: 18 });
    gsap.set(load, { opacity: 0, y: 40, scale: 0.94 });
    gsap.set(arch, { opacity: 0, scaleY: 0.86, transformOrigin: '50% 100%' });
    if (swatches.length) gsap.set(swatches, { opacity: 0, scale: 0.6 });

    const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
    tl.to(arch, { opacity: 1, scaleY: 1, duration: 0.9 }, 0)
      .to(split.words, { yPercent: 0, duration: 0.9, stagger: 0.07 }, 0.05)
      .to(load, { opacity: 1, y: 0, scale: 1, duration: 1.1 }, 0.15)
      .to(fades, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.08 }, 0.3)
      .to(ctas, { opacity: 1, y: 0, duration: 0.7, stagger: 0.08 }, 0.45);
    if (swatches.length) tl.to(swatches, { opacity: 1, scale: 1, duration: 0.8, stagger: 0.08, ease: 'back.out(1.6)' }, 0.5);

    // Played later (after the intro lifts): wrap in contextSafe so it stays
    // inside this matchMedia context.
    introDone.then(contextSafe(() => tl.play()));
  }

  // ── Idle float, paused while the hero is off screen (rule 11).
  const floatTween = gsap.to(float, {
    y: c.desktop ? -14 : -8,
    duration: 3.2,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1,
    paused: true,
  });
  ScrollTrigger.create({
    trigger: section,
    start: 'top bottom',
    end: 'bottom top',
    onToggle(self) {
      if (self.isActive) floatTween.play();
      else floatTween.pause();
    },
  });

  // ── Scroll pose: the chair settles back as the hero leaves.
  gsap.to(pose, {
    yPercent: c.mobile ? 5 : 10,
    scale: 0.92,
    ease: 'none',
    scrollTrigger: { trigger: section, start: 'top top', end: 'bottom top', scrub: true },
  });
  if (copy && !c.mobile) {
    gsap.to(copy, {
      y: c.desktop ? -60 : -30,
      ease: 'none',
      scrollTrigger: { trigger: section, start: 'top top', end: 'bottom top', scrub: true },
    });
  }

  // ── Pointer tilt + swatch parallax: fine pointers on tablet/desktop only.
  // This follows the pointer on screen, so it is physical, not reading-
  // direction motion, and deliberately NOT multiplied by dirSign().
  if (!c.mobile && finePointer() && tilt) {
    const amp = c.desktop ? 8 : 4;
    const rx = gsap.quickTo(tilt, 'rotationX', { duration: 0.8, ease: 'power3.out' });
    const ry = gsap.quickTo(tilt, 'rotationY', { duration: 0.8, ease: 'power3.out' });
    const sw = c.desktop
      ? swatches.map((s, i) => ({
          x: gsap.quickTo(s, 'x', { duration: 1, ease: 'power3.out' }),
          y: gsap.quickTo(s, 'y', { duration: 1, ease: 'power3.out' }),
          depth: 18 + i * 10,
        }))
      : [];
    const onMove = (e) => {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      ry(nx * amp * 2);
      rx(-ny * amp * 2);
      sw.forEach((s) => {
        s.x(nx * s.depth);
        s.y(ny * s.depth);
      });
    };
    const onLeave = () => {
      rx(0);
      ry(0);
      sw.forEach((s) => {
        s.x(0);
        s.y(0);
      });
    };
    section.addEventListener('pointermove', onMove);
    section.addEventListener('pointerleave', onLeave);
    cleanups.push(() => {
      section.removeEventListener('pointermove', onMove);
      section.removeEventListener('pointerleave', onLeave);
    });
  }

  // Magnetic primary CTA (the load-in animates its .cta-load wrapper instead).
  cleanups.push(magnetic($('[data-magnetic]', section)));

  return () => cleanups.forEach((fn) => fn());
}
