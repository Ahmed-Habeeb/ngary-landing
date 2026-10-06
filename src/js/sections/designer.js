// Design your room: a small room planner.
// - colours (walls, floor, fabric, wood) are radios + CSS :has() → no JS needed
// - JS adds room presets, a palette of pieces, drag (pointer) and keyboard
//   moves, removal, a live summary to read out on the phone, copy, reset, and
//   remembers the design in localStorage (a per-visitor convenience only).
// Pieces are positioned with CSS (inset-inline-start: --x * 100%), so they
// follow the stage on resize with no JS; while dragging, only a transform
// moves (quickSetter, no tween per pointermove), then --x is committed.
import { gsap, $, $$, reveal, dirSign } from '../motion.js';

// sym · viewBox · width % · bottom % (null = hangs from the ceiling) · aspect · layer
const ITEMS = {
  rug: ['d-rug', '0 0 400 60', 54, 3, 400 / 60, 1],
  art: ['d-art', '0 0 120 90', 13, 50, 120 / 90, 2],
  pendant: ['d-pendant', '0 0 60 120', 7, null, 0.5, 2],
  shelf: ['d-shelf', '0 0 240 160', 17, 22, 1.5, 3],
  wardrobe: ['d-wardrobe', '0 0 240 160', 18, 22, 1.5, 3],
  sideboard: ['d-sideboard', '0 0 240 160', 26, 22, 1.5, 3],
  dresser: ['d-dresser', '0 0 240 160', 20, 22, 1.5, 3],
  bed: ['d-bed', '0 0 240 160', 40, 12, 1.5, 4],
  sofa: ['d-sofa', '0 0 240 160', 36, 12, 1.5, 4],
  dining: ['d-dining', '0 0 240 160', 38, 12, 1.5, 4],
  desk: ['d-desk', '0 0 240 160', 30, 14, 1.5, 4],
  lamp: ['d-lamp', '0 0 60 200', 7, 12, 0.3, 4],
  armchair: ['chair', '0 0 400 400', 17, 5, 1, 5], // the protagonist
  coffee: ['d-coffee', '0 0 240 160', 20, 3, 1.5, 5],
  officechair: ['d-officechair', '0 0 240 160', 14, 5, 1.5, 5],
  plant: ['d-plant', '0 0 80 160', 8, 5, 0.5, 5],
};
const PRESETS = {
  living: { wall: 'linen', floor: 'oak', items: { rug: 0.22, art: 0.42, sofa: 0.3, lamp: 0.8, armchair: 0.06, coffee: 0.4, plant: 0.88 } },
  bedroom: { wall: 'lilac', floor: 'walnut', items: { rug: 0.2, art: 0.43, bed: 0.29, dresser: 0.75, lamp: 0.19, plant: 0.03 } },
  dining: { wall: 'white', floor: 'stone', items: { rug: 0.2, pendant: 0.46, dining: 0.31, sideboard: 0.71, art: 0.78, plant: 0.04 } },
  office: { wall: 'charcoal', floor: 'walnut', items: { shelf: 0.06, desk: 0.4, officechair: 0.47, lamp: 0.8, art: 0.45, plant: 0.9 } },
};
const KEY = 'nagary:room';
const clamp = (min, max, v) => Math.min(max, Math.max(min, v));
const round = (v) => Math.round(v * 1000) / 1000;
const maxX = (type) => 1 - ITEMS[type][2] / 100;

export default function designer(c, contextSafe) {
  const root = $('.designer');
  const stage = root && $('[data-d-stage]', root);
  const layer = stage && $('[data-d-items]', stage);
  if (!layer) return;
  const toggles = $$('.d-toggle', root);
  const presets = $$('.d-preset', root);
  const summaryEl = $('[data-d-summary]', root);
  const copyBtn = $('[data-d-copy]', root);
  const names = Object.fromEntries(toggles.map((t) => [t.dataset.item, $('span', t).textContent.trim()]));
  // physical (pointer / arrow key) direction → logical x along inline-start (rule 13)
  const s = -dirSign();
  const timers = [];

  const radio = (group) => $(`input[name="d-${group}"]:checked`, root);
  const setRadio = (group, value) => {
    const input = $(`#d-${group}-${value}`, root);
    if (input) input.checked = true;
  };
  const labelOf = (group) => {
    const input = radio(group);
    const label = input && $(`label[for="${input.id}"] .sw-name`, root);
    return label ? label.textContent.trim() : '';
  };

  // ── state
  const fresh = (preset) => ({ preset, items: { ...PRESETS[preset].items } });
  const load = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!saved || !PRESETS[saved.preset] || typeof saved.items !== 'object') return null;
      const items = {};
      for (const [type, x] of Object.entries(saved.items)) {
        if (ITEMS[type] && Number.isFinite(x)) items[type] = clamp(0, maxX(type), x);
      }
      ['wall', 'floor', 'seat', 'wood'].forEach((g) => saved[g] && setRadio(g, saved[g]));
      return { preset: saved.preset, items };
    } catch {
      return null;
    }
  };
  const save = () => {
    try {
      const data = { ...state };
      ['wall', 'floor', 'seat', 'wood'].forEach((g) => (data[g] = radio(g)?.value));
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* private mode / blocked storage: the planner still works, it just won't remember */
    }
  };
  let state = load() || fresh('living');

  // ── rendering
  const makeItem = (type, x) => {
    const [sym, vb, w, b, ar, z] = ITEMS[type];
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'd-item';
    el.dataset.type = type;
    if (b === null) el.dataset.anchor = 'top';
    el.style.cssText = `--x:${x};--w:${w}%;--b:${b ?? 0}%;--ar:${ar};--z:${z}`;
    el.setAttribute('aria-label', (root.dataset.itemAria || '{name}').replace('{name}', names[type] || type));
    el.innerHTML = `<span class="d-art"><svg viewBox="${vb}" aria-hidden="true" focusable="false"><use href="#${sym}"/></svg></span>`;
    return el;
  };
  const popIn = contextSafe((arts) => {
    if (!arts.length || c.reduce) return;
    gsap.fromTo(arts, { opacity: 0, y: -28, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(1.8)', stagger: 0.05 });
  });
  const summary = () => {
    const list = Object.keys(state.items).map((t) => names[t] || t);
    const room = presets.find((p) => p.dataset.preset === state.preset);
    return (root.dataset.pattern || '')
      .replace('{room}', room ? room.textContent.trim() : '')
      .replace('{wall}', labelOf('wall'))
      .replace('{floor}', labelOf('floor'))
      .replace('{seat}', labelOf('seat'))
      .replace('{wood}', labelOf('wood'))
      .replace('{count}', String(list.length))
      .replace('{list}', list.length ? list.join(document.documentElement.lang === 'ar' ? '، ' : ', ') : root.dataset.none || '');
  };
  const update = () => {
    toggles.forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.item in state.items)));
    presets.forEach((p) => p.setAttribute('aria-pressed', String(p.dataset.preset === state.preset)));
    if (summaryEl) summaryEl.textContent = summary();
  };
  const render = (animate) => {
    layer.replaceChildren(...Object.entries(state.items).map(([type, x]) => makeItem(type, x)));
    if (animate) popIn($$('.d-art', layer));
    update();
  };
  render(false);

  // First arrival: the pieces drop into the room once (scroll-triggered).
  if (!c.reduce) {
    reveal($$('[data-reveal]', root));
    const arts = $$('.d-art', layer);
    if (arts.length) {
      gsap.set(arts, { opacity: 0, y: -24 });
      gsap.to(arts, { opacity: 1, y: 0, duration: 0.6, stagger: 0.07, ease: 'back.out(1.6)', scrollTrigger: { trigger: stage, start: 'top 75%', once: true } });
    }
  }

  // ── add / remove
  // Where a new piece goes: its preset spot if it has one, otherwise the
  // position that overlaps the floor pieces already there the least.
  const FLAT = new Set(['rug', 'art', 'pendant']);
  const freeSpot = (type) => {
    const w = ITEMS[type][2] / 100;
    let best = 0.5 - w / 2;
    let bestCost = Infinity;
    for (let x = 0; x <= maxX(type) + 1e-9; x += 0.01) {
      let cost = Math.abs(x + w / 2 - 0.5) * 0.05; // prefer the middle on ties
      for (const [other, ox] of Object.entries(state.items)) {
        if (FLAT.has(other) || FLAT.has(type)) continue;
        const ow = ITEMS[other][2] / 100;
        cost += Math.max(0, Math.min(x + w, ox + ow) - Math.max(x, ox));
      }
      if (cost < bestCost) {
        bestCost = cost;
        best = x;
      }
    }
    return round(clamp(0, maxX(type), best));
  };
  const add = (type) => {
    const x = PRESETS[state.preset].items[type] ?? freeSpot(type);
    state.items[type] = x;
    const el = makeItem(type, x);
    layer.append(el);
    popIn([el.firstElementChild]);
    update();
    save();
  };
  const remove = (type, refocus) => {
    const el = $(`.d-item[data-type="${type}"]`, layer);
    delete state.items[type];
    if (el) {
      if (c.reduce) el.remove();
      else contextSafe(() => gsap.to(el.firstElementChild, { opacity: 0, y: 18, duration: 0.22, onComplete: () => el.remove() }))();
    }
    update();
    save();
    if (refocus) $(`.d-toggle[data-item="${type}"]`, root)?.focus();
  };

  // ── pointer drag (one quickSetter per drag; no tween per pointermove)
  let drag = null;
  const onDown = (e) => {
    const item = e.target.closest('.d-item');
    if (!item || e.button > 0) return;
    e.preventDefault();
    item.setPointerCapture(e.pointerId);
    item.focus({ preventScroll: true });
    item.classList.add('is-dragging');
    drag = {
      item,
      id: e.pointerId,
      startX: e.clientX,
      W: stage.clientWidth, // rule 6: layout size, not a transformed rect
      x0: state.items[item.dataset.type],
      max: maxX(item.dataset.type),
      setX: gsap.quickSetter(item, 'x', 'px'),
    };
  };
  const onMove = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const nx = clamp(0, drag.max, drag.x0 + ((e.clientX - drag.startX) / drag.W) * s);
    drag.nx = nx;
    drag.setX((nx - drag.x0) * drag.W * s);
  };
  const onUp = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { item, nx, setX } = drag;
    item.classList.remove('is-dragging');
    if (nx != null) {
      state.items[item.dataset.type] = round(nx);
      item.style.setProperty('--x', round(nx));
    }
    setX(0);
    drag = null;
    save();
  };

  // ── keyboard: arrows move (Shift = bigger steps), Delete/Backspace removes
  const onKey = (e) => {
    const item = e.target.closest('.d-item');
    if (!item) return;
    const type = item.dataset.type;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const phys = e.key === 'ArrowRight' ? 1 : -1;
      const x = round(clamp(0, maxX(type), state.items[type] + (e.shiftKey ? 0.08 : 0.02) * phys * s));
      state.items[type] = x;
      item.style.setProperty('--x', x);
      save();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      remove(type, true);
    }
  };

  // ── controls
  const onClick = (e) => {
    const toggle = e.target.closest('.d-toggle');
    if (toggle) {
      const type = toggle.dataset.item;
      if (type in state.items) remove(type);
      else add(type);
      return;
    }
    const preset = e.target.closest('.d-preset');
    if (preset && PRESETS[preset.dataset.preset]) {
      const p = PRESETS[preset.dataset.preset];
      state = fresh(preset.dataset.preset);
      setRadio('wall', p.wall);
      setRadio('floor', p.floor);
      render(true);
      save();
      return;
    }
    if (e.target.closest('[data-d-reset]')) {
      state = fresh('living');
      setRadio('wall', 'linen');
      setRadio('floor', 'oak');
      setRadio('seat', 'plum');
      setRadio('wood', 'walnut');
      render(true);
      save();
      return;
    }
    if (e.target.closest('[data-d-copy]') && copyBtn) {
      const text = summary();
      const done = () => {
        const label = copyBtn.textContent;
        copyBtn.textContent = root.dataset.copied || label;
        timers.push(setTimeout(() => (copyBtn.textContent = label), 2000));
      };
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => {});
    }
  };
  const onChange = (e) => {
    if (e.target.matches('.sw-input')) {
      update();
      save();
    }
  };

  stage.addEventListener('pointerdown', onDown);
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerup', onUp);
  stage.addEventListener('pointercancel', onUp);
  stage.addEventListener('keydown', onKey);
  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);

  return () => {
    stage.removeEventListener('pointerdown', onDown);
    stage.removeEventListener('pointermove', onMove);
    stage.removeEventListener('pointerup', onUp);
    stage.removeEventListener('pointercancel', onUp);
    stage.removeEventListener('keydown', onKey);
    root.removeEventListener('click', onClick);
    root.removeEventListener('change', onChange);
    timers.forEach(clearTimeout);
    // the rendered pieces stay; the next matchMedia run re-renders from state
  };
}
