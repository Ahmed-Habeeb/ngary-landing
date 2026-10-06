// Shared motion setup + small helpers. Plugins are registered exactly once here.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
// Mobile address-bar show/hide changes innerHeight; don't re-measure for it.
ScrollTrigger.config({ ignoreMobileResize: true });

export { gsap, ScrollTrigger };

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** +1 in RTL, −1 in LTR. `d * dirSign()` is an offset toward the inline-start side. */
export const dirSign = () => (document.documentElement.dir === 'rtl' ? 1 : -1);

export const finePointer = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

/**
 * Scroll-triggered fade/rise. autoAlpha by default, for LEAF elements; pass
 * fade:'opacity' for a wrapper whose children animate (autoAlpha's
 * visibility would be inherited by them, rule 2).
 * - empty lists are a no-op (rule 7: no "target not found" warnings)
 * - an element can only be registered once (rule 4); main.js clears the
 *   marker in its matchMedia cleanup so a re-run can register it again
 * - the hidden state is set here with gsap.set, never in CSS (rules 1 and 5)
 * Everything is created synchronously, so the matchMedia context reverts it.
 */
export function reveal(
  targets,
  { y = 28, stagger = 0.08, start = 'top 86%', duration = 0.8, each = false, trigger, fade = 'autoAlpha' } = {},
) {
  const list = typeof targets === 'string' ? $$(targets) : Array.from(targets || []);
  const els = list.filter((el) => el && !el.hasAttribute('data-revealed'));
  if (!els.length) return;
  els.forEach((el) => el.setAttribute('data-revealed', ''));
  // fade: 'opacity' for wrappers whose children animate too (rule 2).
  gsap.set(els, { [fade]: 0, y });
  const vars = { [fade]: 1, y: 0, duration, ease: 'power3.out' };
  if (each) {
    els.forEach((el) => gsap.to(el, { ...vars, scrollTrigger: { trigger: el, start, once: true } }));
  } else {
    gsap.to(els, { ...vars, stagger, scrollTrigger: { trigger: trigger || els[0], start, once: true } });
  }
}

/**
 * Split an element's text into WORDS (never letters: letter-splitting breaks
 * Arabic joining, rule 13). Inline children such as <em> are kept and split
 * inside; a <bdi> counts as one word so a Latin run inside Arabic keeps its
 * order. Screen readers get one clean sr-only copy; the split is aria-hidden.
 * Returns { words, revert }.
 */
export function splitWords(el) {
  if (!el) return { words: [], revert() {} };
  const original = el.innerHTML;
  const label = el.textContent.replace(/\s+/g, ' ').trim();
  const words = [];

  const mask = (content) => {
    const outer = document.createElement('span');
    outer.className = 'word-mask';
    const inner = document.createElement('span');
    inner.className = 'word';
    inner.append(content);
    outer.append(inner);
    words.push(inner);
    return outer;
  };

  const walk = (parent) => {
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        for (const part of node.textContent.split(/(\s+)/)) {
          if (!part) continue;
          frag.append(/^\s+$/.test(part) ? document.createTextNode(' ') : mask(document.createTextNode(part)));
        }
        node.replaceWith(frag);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.tagName === 'BDI') {
          const placeholder = document.createComment('');
          node.replaceWith(placeholder);
          placeholder.replaceWith(mask(node));
        } else if (node.tagName !== 'BR') {
          walk(node);
        }
      }
    }
  };

  const visual = document.createElement('span');
  visual.setAttribute('aria-hidden', 'true');
  visual.innerHTML = original;
  walk(visual);
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = label;
  el.replaceChildren(sr, visual);

  return {
    words,
    revert() {
      el.innerHTML = original;
    },
  };
}

/**
 * Magnetic pull toward the pointer (fine pointers only). Animates x/y of the
 * button itself, so any load-in must animate a WRAPPER instead (rule 3).
 * Geometry comes from the parent, which never moves with the magnet.
 * The quickTo tweens are created synchronously (reverted by the context);
 * the returned cleanup removes the listeners.
 */
export function magnetic(el, { strength = 0.3, max = 12 } = {}) {
  if (!el || !finePointer()) return () => {};
  const clamp = gsap.utils.clamp(-max, max);
  const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
  const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
  const host = el.parentElement || el;
  const move = (e) => {
    const r = host.getBoundingClientRect();
    xTo(clamp((e.clientX - (r.left + r.width / 2)) * strength));
    yTo(clamp((e.clientY - (r.top + r.height / 2)) * strength));
  };
  const leave = () => {
    xTo(0);
    yTo(0);
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerleave', leave);
  return () => {
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerleave', leave);
  };
}

/** True once the browser has painted content (used to avoid a load-in flash). */
export const hasPainted = () =>
  performance.getEntriesByType('paint').some((e) => e.name === 'first-contentful-paint');
