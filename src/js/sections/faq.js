// FAQ: native <details> (works without JS). JS only fades the answer in.
import { gsap, $, $$, reveal } from '../motion.js';

export default function faq(c) {
  const section = $('.faq');
  const items = section ? $$('.faq-item', section) : [];
  if (!items.length || c.reduce) return;

  reveal($$('[data-reveal]', section));
  // the items wrap an animated answer: fade them with opacity (rule 2)
  reveal(items, { each: true, y: 20, fade: 'opacity' });

  // one paused timeline per item, restarted when it opens (no tween per event)
  const anims = items.map((item) => {
    const p = $('.faq-a p', item);
    return p
      ? gsap.timeline({ paused: true }).fromTo(p, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', immediateRender: false })
      : null;
  });
  const onToggle = (e) => {
    const i = items.indexOf(e.currentTarget);
    if (i > -1 && items[i].open && anims[i]) anims[i].restart();
  };
  items.forEach((item) => item.addEventListener('toggle', onToggle));
  return () => items.forEach((item) => item.removeEventListener('toggle', onToggle));
}
