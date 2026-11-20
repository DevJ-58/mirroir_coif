import gsap from 'gsap';

let el, label, forced = null;

export function initCursor() {
  el = document.getElementById('cursor');
  label = el.querySelector('.cursor__label');
  if (window.matchMedia('(hover: none)').matches) return;
  const ring = el.querySelector('.cursor__ring'), dot = el.querySelector('.cursor__dot');
  const pos = { x: innerWidth / 2, y: innerHeight / 2 }, rp = { ...pos };
  window.addEventListener('pointermove', (e) => {
    pos.x = e.clientX; pos.y = e.clientY;
    dot.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
    if (!forced) update(e.target);
  });
  gsap.ticker.add(() => {
    rp.x += (pos.x - rp.x) * 0.18; rp.y += (pos.y - rp.y) * 0.18;
    ring.style.transform = `translate(${rp.x}px, ${rp.y}px)`;
  });
  document.addEventListener('pointerleave', () => gsap.to(el, { opacity: 0, duration: 0.3 }));
  document.addEventListener('pointerenter', () => gsap.to(el, { opacity: 1, duration: 0.3 }));
}

function update(target) {
  const lab = target.closest?.('[data-cursor]');
  const hov = target.closest?.('button, a, label, .sw');
  el.classList.toggle('is-label', !!lab);
  el.classList.toggle('is-hover', !lab && !!hov);
  if (lab) label.textContent = lab.dataset.cursor;
}

export function setCursor(mode) {
  if (!el) return;
  forced = mode;
  el.classList.toggle('is-drag', mode === 'drag');
  if (mode) { el.classList.remove('is-label', 'is-hover'); }
}

export function initMagnetic() {
  if (window.matchMedia('(hover: none)').matches) return;
  document.querySelectorAll('.magnetic').forEach((b) => {
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
      gsap.to(b, { x: x * 0.25, y: y * 0.35, duration: 0.6, ease: 'power3.out' });
    });
    b.addEventListener('pointerleave', () => gsap.to(b, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)' }));
  });
}
