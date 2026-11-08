/* Icons, modals, toasts and small UI primitives. */

import { esc } from './util.js';

const svg = (paths) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const ICON = {
  menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>'),
  moon: svg('<path d="M20 14.5A8.5 8.5 0 019.5 4a7 7 0 108.5 10.5z"/>'),
  chevronLeft: svg('<path d="M15 5l-7 7 7 7"/>'),
  chevronRight: svg('<path d="M9 5l7 7-7 7"/>'),
  chevronDown: svg('<path d="M6 9l6 6 6-6"/>'),
  x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  trash: svg('<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6"/>'),
  copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 012-2h8"/>'),
  undo: svg('<path d="M4 9h11a5 5 0 010 10H8"/><path d="M4 9l4-4M4 9l4 4"/>'),
  redo: svg('<path d="M20 9H9a5 5 0 000 10h7"/><path d="M20 9l-4-4M20 9l-4 4"/>'),
  download: svg('<path d="M12 4v11M8 11l4 4 4-4M4 20h16"/>'),
  upload: svg('<path d="M12 20V9M8 13l4-4 4 4M4 4h16"/>'),
  printer: svg('<path d="M7 8V3h10v5M7 17H5a2 2 0 01-2-2v-4a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2h-2"/><rect x="7" y="13" width="10" height="8" rx="1"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  mapPin: svg('<path d="M12 21s7-5.5 7-11a7 7 0 10-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>'),
  flag: svg('<path d="M5 21V4M5 5h11l-2 3 2 3H5"/>'),
  target: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>'),
  play: svg('<path d="M8 5l11 7-11 7V5z"/>'),
  pause: svg('<path d="M8 5v14M16 5v14"/>'),
  reset: svg('<path d="M4 10a8 8 0 111.5 7"/><path d="M4 4v6h6"/>'),
  command: svg('<path d="M9 6a3 3 0 10-3 3h12a3 3 0 10-3-3v12a3 3 0 103-3H6a3 3 0 103 3V6z"/>'),
  sparkles: svg('<path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z"/><path d="M18 16l.9 2.1L21 19l-2.1.9L18 22l-.9-2.1L15 19l2.1-.9L18 16z"/>'),
  grip: svg('<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>'),
  alert: svg('<path d="M12 4l9 16H3L12 4z"/><path d="M12 10v4M12 17h.01"/>'),
  check: svg('<path d="M5 13l4 4L19 7"/>'),
  bell: svg('<path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 20a2 2 0 004 0"/>'),
  repeat: svg('<path d="M4 9V7a3 3 0 013-3h10l-3-3M20 15v2a3 3 0 01-3 3H7l3 3M20 9l-3-3M4 15l3 3"/>'),
  calendar: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>'),
  tasks: svg('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12l2.5 2.5L16 9"/>'),
  note: svg('<path d="M6 3h9l4 4v14H6V3z"/><path d="M15 3v4h4M9 12h7M9 16h5"/>'),
  chart: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  timer: svg('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>'),
  settings: svg('<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>'),
  edit: svg('<path d="M4 20h4l11-11a2.8 2.8 0 10-4-4L4 16v4z"/>'),
  arrowRight: svg('<path d="M4 12h15M14 6l6 6-6 6"/>'),
  inbox: svg('<path d="M3 13l3-8h12l3 8v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6z"/><path d="M3 13h5l1 2h6l1-2h5"/>'),
  coffee: svg('<path d="M4 8h13v6a5 5 0 01-5 5H9a5 5 0 01-5-5V8z"/><path d="M17 9h2a2 2 0 110 4h-2M4 21h14"/>'),
  book: svg('<path d="M4 4h6a3 3 0 013 3v13a2.5 2.5 0 00-2.5-2.5H4V4z"/><path d="M20 4h-6a3 3 0 00-3 3v13a2.5 2.5 0 012.5-2.5H20V4z"/>'),
  filter: svg('<path d="M3 5h18l-7 8v6l-4 2v-8L3 5z"/>'),
  more: svg('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'),
  external: svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>'),
};

/** Wrap an icon in a span so it can be styled/sized consistently. */
export function icon(name, cls = '') {
  return `<span class="ico ${cls}" aria-hidden="true">${ICON[name] || ''}</span>`;
}

/* ---------------------------------------------------------------- modals */

let active = null;

export function openModal({
  title = '', subtitle = '', body = '', footer = '', size = 'md', className = '', onClose = null,
}) {
  closeModal();
  const root = document.getElementById('modal-root');
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `
    <div class="modal modal-${size} ${className}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head">
        <div class="modal-head-text">
          <h2 class="modal-title">${esc(title)}</h2>
          ${subtitle ? `<p class="modal-subtitle">${esc(subtitle)}</p>` : ''}
        </div>
        <button type="button" class="icon-btn modal-close" data-modal-close aria-label="Close">${ICON.x}</button>
      </div>
      <div class="modal-body"></div>
      <div class="modal-foot"></div>
    </div>`;
  wrap.querySelector('.modal-body').innerHTML = body;
  const foot = wrap.querySelector('.modal-foot');
  foot.innerHTML = footer;
  if (!footer) foot.remove();
  root.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('is-open'));

  const api = {
    el: wrap,
    box: wrap.querySelector('.modal'),
    body: wrap.querySelector('.modal-body'),
    foot,
    close: (result) => {
      if (!active || active.wrap !== wrap) return;
      active = null;
      wrap.classList.remove('is-open');
      setTimeout(() => wrap.remove(), 160);
      if (onClose) onClose(result);
    },
  };

  active = { wrap, api, onClose };
  wrap.addEventListener('mousedown', (e) => {
    if (e.target === wrap) api.close();
  });
  wrap.querySelector('[data-modal-close]').addEventListener('click', () => api.close());
  setTimeout(() => {
    const target = wrap.querySelector('[data-autofocus]') || wrap.querySelector('input, textarea, select, button');
    if (target) target.focus();
    if (target && target.select && target.tagName === 'INPUT' && target.type === 'text') target.select();
  }, 30);
  return api;
}

export function closeModal() {
  if (active) active.api.close();
}

export function hasModal() {
  return !!active;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && active) {
    e.stopPropagation();
    active.api.close();
  }
});

export function confirmDialog({
  title = 'Are you sure?', message = '', confirmText = 'Confirm', cancelText = 'Cancel', danger = false,
}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const modal = openModal({
      title,
      size: 'sm',
      body: `<p class="modal-text">${message}</p>`,
      footer: `<button type="button" class="btn" data-cancel>${esc(cancelText)}</button>
               <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm data-autofocus>${esc(confirmText)}</button>`,
      onClose: () => finish(false),
    });
    modal.el.querySelector('[data-cancel]').addEventListener('click', () => {
      finish(false);
      modal.close();
    });
    modal.el.querySelector('[data-confirm]').addEventListener('click', () => {
      finish(true);
      modal.close();
    });
  });
}

export function promptDialog({
  title = 'Enter a value', label = '', value = '', placeholder = '', confirmText = 'Save',
}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    const modal = openModal({
      title,
      size: 'sm',
      body: `<label class="field"><span class="field-label">${esc(label)}</span>
        <input class="input" name="value" value="${esc(value)}" placeholder="${esc(placeholder)}" data-autofocus></label>`,
      footer: `<button type="button" class="btn" data-cancel>Cancel</button>
               <button type="button" class="btn btn-primary" data-ok>${esc(confirmText)}</button>`,
      onClose: () => finish(null),
    });
    const input = modal.el.querySelector('input');
    const commit = () => {
      const v = input.value.trim();
      if (!v) return;
      finish(v);
      modal.close();
    };
    modal.el.querySelector('[data-cancel]').addEventListener('click', () => {
      finish(null);
      modal.close();
    });
    modal.el.querySelector('[data-ok]').addEventListener('click', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      }
    });
  });
}

/* ---------------------------------------------------------------- toasts */

export function toast(message, { type = 'info', action = null, duration = 3600 } = {}) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `
    <span class="toast-dot"></span>
    <span class="toast-msg">${esc(message)}</span>
    ${action ? `<button type="button" class="toast-action">${esc(action.label)}</button>` : ''}`;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-open'));
  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    el.classList.remove('is-open');
    setTimeout(() => el.remove(), 200);
  };
  const timer = duration > 0 ? setTimeout(remove, duration) : null;
  el.addEventListener('click', (e) => {
    if (e.target.closest('.toast-action') && action) {
      clearTimeout(timer);
      action.onClick?.();
      remove();
    }
  });
  return { remove };
}

/* ------------------------------------------------------------------ misc */

let audioCtx = null;
export function beep(frequency = 660, duration = 0.16) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, audioCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration + 0.02);
  } catch {
    /* audio is a nice-to-have */
  }
}

export function pageHead({ eyebrow = '', title = '', subtitle = '', actions = '' }) {
  return `
    <div class="page-head">
      <div class="page-head-text">
        ${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ''}
        <h1 class="page-title">${esc(title)}</h1>
        ${subtitle ? `<p class="page-subtitle">${esc(subtitle)}</p>` : ''}
      </div>
      ${actions ? `<div class="page-actions">${actions}</div>` : ''}
    </div>`;
}
