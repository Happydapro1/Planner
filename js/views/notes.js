/* Daily notes with autosave, search and a same-day context panel. */

import * as store from '../store.js';
import { icon, pageHead, toast, confirmDialog, beep } from '../ui.js';
import { openEventModal } from '../event-modal.js';
import { openTaskModal } from '../task-modal.js';
import {
  dateKey, parseKey, esc, formatLongDate, isToday, timeLabel, diffDays,
} from '../util.js';

let saveTimer = null;
let statusTimer = null;
const drafts = new Map();
let search = '';

function flushNote(date) {
  if (!date) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  const value = drafts.has(date) ? drafts.get(date) : (store.get().notes[date] || '');
  store.setNote(date, value, { silent: true });
  const status = document.querySelector('[data-note-status]');
  if (status) status.textContent = 'Saved locally';
}

function wordsIn(text) {
  const trimmed = String(text || '').trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function preview(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > 70 ? `${clean.slice(0, 70)}…` : clean || 'Empty note';
}

function noteList(state, selected) {
  const keys = new Set(Object.keys(state.notes));
  keys.add(selected);
  keys.add(dateKey(new Date()));
  const sorted = Array.from(keys).sort((a, b) => b.localeCompare(a));
  return sorted
    .map((key) => {
      const d = parseKey(key);
      const text = state.notes[key] || '';
      const active = key === selected;
      return `
        <button type="button" class="note-item ${active ? 'is-active' : ''}" data-note="${key}"
          data-search="${esc((text + ' ' + formatLongDate(d)).toLowerCase())}">
          <span class="note-item-date">
            <span class="note-item-day">${isToday(d) ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
            <span class="note-item-num">${d.getDate()}</span>
            <span class="note-item-month">${d.toLocaleDateString(undefined, { month: 'short' })}</span>
          </span>
          <span class="note-item-body">
            <span class="note-item-title">${formatLongDate(d)}</span>
            <span class="note-item-preview">${esc(preview(text))}</span>
          </span>
          ${active ? `<span class="note-item-active-dot"></span>` : ''}
        </button>`;
    })
    .join('');
}

export function renderNotes(root, state) {
  const selected = state.ui.noteDate || dateKey(new Date());
  const date = parseKey(selected) || new Date();
  const text = drafts.has(selected) ? drafts.get(selected) : (state.notes[selected] || '');
  const instances = store.instancesForDate(state, date);
  const dueTasks = state.tasks.filter((t) => !t.done && t.due === selected);
  const noteCount = Object.keys(state.notes).length;

  const html = `
    <section class="page page-notes">
      ${pageHead({
        eyebrow: 'Journal',
        title: 'Notes',
        subtitle: `${noteCount} ${noteCount === 1 ? 'note' : 'notes'} saved on this device`,
        actions: `<button type="button" class="btn btn-primary" data-new-note>${icon('plus')} New note</button>`,
      })}
      <div class="notes-layout">
        <aside class="notes-list card">
          <div class="notes-list-head">
            <div class="notes-search">
              ${icon('search')}
              <input class="input input-sm" type="search" placeholder="Search notes…" value="${esc(search)}"
                data-note-search aria-label="Search notes" autocomplete="off">
              <button type="button" class="icon-btn icon-btn-sm notes-search-clear ${search ? '' : 'is-hidden'}"
                data-note-search-clear title="Clear search" aria-label="Clear search">${icon('x')}</button>
            </div>
          </div>
          <div class="note-items" data-note-items>
            ${noteList(state, selected)}
            <div class="note-search-empty" data-note-empty hidden>
              <p data-note-empty-text>No notes match that search.</p>
              <button type="button" class="btn btn-ghost btn-sm" data-note-empty-clear>Clear search</button>
            </div>
          </div>
          <div class="notes-list-foot">
            <div class="field-inline">
              <span>Open another day</span>
              <input class="input input-sm" type="date" value="${selected}" data-note-jump>
            </div>
          </div>
        </aside>

        <div class="note-main card">
          <div class="note-head">
            <div>
              <div class="note-date">${formatLongDate(date)}</div>
              <div class="note-sub" data-note-status>Saved locally</div>
            </div>
            <div class="note-actions">
              <button type="button" class="icon-btn icon-btn-sm" data-note-copy title="Copy note">${icon('copy')}</button>
              <button type="button" class="icon-btn icon-btn-sm" data-note-delete title="Delete note">${icon('trash')}</button>
            </div>
          </div>
          <textarea class="note-editor" data-editor spellcheck="true"
            placeholder="How did today go? What matters tomorrow?">${esc(text)}</textarea>
          <div class="note-foot">
            <span data-note-words>${wordsIn(text)} words</span>
            <span class="note-foot-hint">Autosaved in your browser · ⌘S to save</span>
          </div>
          <div class="note-context">
            <div class="note-context-head">
              <h3>${icon('calendar')} On this day</h3>
              <span>${instances.length} ${instances.length === 1 ? 'block' : 'blocks'}${dueTasks.length ? ` · ${dueTasks.length} due` : ''}</span>
            </div>
            <div class="note-context-list">
              ${instances.length || dueTasks.length ? '' : '<p class="note-context-empty">Nothing scheduled. A quiet day.</p>'}
              ${instances
                .map(
                  (inst) => `
                <button type="button" class="context-row" data-ctx-event="${inst.id}" data-ctx-date="${selected}">
                  <span class="context-dot" style="--cat:${store.catColor(inst.event.catId)}"></span>
                  <span class="context-time">${timeLabel(inst.start, state.settings.hour24)}</span>
                  <span class="context-title">${esc(inst.event.title)}</span>
                  <span class="context-extra">${esc(inst.event.location || '')}</span>
                </button>`,
                )
                .join('')}
              ${dueTasks
                .map(
                  (task) => `
                <button type="button" class="context-row" data-ctx-task="${task.id}">
                  ${icon('tasks')}
                  <span class="context-title">${esc(task.title)}</span>
                  <span class="context-extra">due today</span>
                </button>`,
                )
                .join('')}
            </div>
          </div>
        </div>
      </div>
    </section>`;

  root.innerHTML = html;
  mount(root, state, selected, date);
  applySearch(root);
}

function applySearch(root) {
  const q = search.trim().toLowerCase();
  let visible = 0;
  root.querySelectorAll('.note-item').forEach((item) => {
    const match = !q || (item.dataset.search || '').includes(q);
    item.hidden = !match;
    if (match) visible += 1;
  });

  const empty = root.querySelector('[data-note-empty]');
  if (empty) {
    const noHits = !!q && visible === 0;
    empty.hidden = !noHits;
    const text = root.querySelector('[data-note-empty-text]');
    if (text) text.textContent = noHits ? `No notes match “${search.trim()}”.` : '';
  }

  root.querySelector('[data-note-search-clear]')?.classList.toggle('is-hidden', !search);
  return visible;
}

function mount(root, state, selected, date) {
  const editor = root.querySelector('[data-editor]');
  const words = root.querySelector('[data-note-words]');
  const status = root.querySelector('[data-note-status]');

  const markSaving = () => {
    clearTimeout(statusTimer);
    if (status) status.textContent = 'Saving…';
  };

  const updateItemPreview = (value) => {
    const item = root.querySelector(`[data-note="${selected}"]`);
    if (!item) return;
    const el = item.querySelector('.note-item-preview');
    if (el) el.textContent = preview(value);
    item.dataset.search = `${value} ${formatLongDate(date)}`.toLowerCase();
  };

  editor.addEventListener('input', () => {
    drafts.set(selected, editor.value);
    if (words) words.textContent = `${wordsIn(editor.value)} words`;
    updateItemPreview(editor.value);
    markSaving();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      flushNote(selected);
      const statusEl = root.querySelector('[data-note-status]');
      if (statusEl) statusEl.textContent = 'Saved locally';
    }, 500);
  });

  editor.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      flushNote(selected);
      toast('Note saved', { type: 'success' });
    }
  });

  const saveNow = () => {
    drafts.set(selected, editor.value);
    flushNote(selected);
  };

  root.querySelectorAll('[data-note]').forEach((btn) => {
    btn.addEventListener('click', () => {
      saveNow();
      store.setUi({ noteDate: btn.dataset.note });
    });
  });

  root.querySelector('[data-note-search]')?.addEventListener('input', (e) => {
    search = e.target.value;
    applySearch(root);
  });

  const searchInput = root.querySelector('[data-note-search]');
  const clearSearch = () => {
    if (!searchInput) return;
    searchInput.value = '';
    search = '';
    applySearch(root);
    searchInput.focus();
  };
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && searchInput.value) {
      e.preventDefault();
      clearSearch();
    }
  });
  root.querySelector('[data-note-search-clear]')?.addEventListener('click', clearSearch);
  root.querySelector('[data-note-empty-clear]')?.addEventListener('click', clearSearch);

  // Coming back to Notes with a query in place keeps the field focused and the filter applied.
  if (searchInput && search) {
    searchInput.setSelectionRange(search.length, search.length);
  }

  root.querySelector('[data-note-jump]')?.addEventListener('change', (e) => {
    if (!e.target.value) return;
    saveNow();
    store.setUi({ noteDate: e.target.value });
  });

  root.querySelector('[data-new-note]')?.addEventListener('click', () => {
    saveNow();
    store.setUi({ noteDate: dateKey(new Date()) });
    setTimeout(() => {
      const el = document.querySelector('[data-editor]');
      if (el) el.focus();
    }, 30);
  });

  root.querySelector('[data-note-copy]')?.addEventListener('click', async () => {
    const value = editor.value;
    if (!value.trim()) {
      toast('Nothing to copy', { type: 'warn' });
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast('Note copied to clipboard', { type: 'success' });
    } catch {
      toast('Clipboard blocked by the browser', { type: 'warn' });
    }
  });

  root.querySelector('[data-note-delete]')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Delete this note?',
      message: `The note for ${formatLongDate(date)} will be removed.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    clearTimeout(saveTimer);
    drafts.delete(selected);
    store.mutate((st) => {
      delete st.notes[selected];
    });
    toast('Note deleted', { type: 'success', action: { label: 'Undo', onClick: () => store.undo() } });
  });

  root.querySelectorAll('[data-ctx-event]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ev = store.get().events.find((x) => x.id === btn.dataset.ctxEvent);
      if (ev) openEventModal({ event: ev, date });
    });
  });
  root.querySelectorAll('[data-ctx-task]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const task = store.get().tasks.find((x) => x.id === btn.dataset.ctxTask);
      if (task) openTaskModal({ task });
    });
  });

  if (status) {
    clearTimeout(statusTimer);
    status.textContent = 'Saved locally';
  }
}
