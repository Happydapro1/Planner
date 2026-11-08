/* ⌘K command palette: jump anywhere, create things, search everything. */

import * as store from './store.js';
import { ICON, icon, openModal, toast } from './ui.js';
import { openEventModal } from './event-modal.js';
import { openTaskModal } from './task-modal.js';
import { scheduleTask } from './schedule.js';
import {
  dateKey, parseKey, addDays, startOfWeek, timeLabel, esc, clamp, snapMinutes,
  formatShortDate, downloadFile, DAY_SHORT,
} from './util.js';

function nextDateFor(event) {
  if (event.repeat !== 'weekly') return parseKey(event.date) || new Date();
  const today = new Date();
  const delta = ((event.weekday - today.getDay() + 7) % 7);
  return addDays(today, delta);
}

function newEventNow() {
  const s = store.get().settings;
  const now = new Date();
  const start = clamp(
    snapMinutes(now.getHours() * 60 + now.getMinutes(), s.slot),
    s.dayStart,
    s.dayEnd - s.defaultDuration,
  );
  openEventModal({ date: now, start, end: Math.min(s.dayEnd, start + s.defaultDuration) });
}

function commands() {
  return [
    { id: 'new-event', icon: 'plus', label: 'New event', hint: 'Add a timetable block', keys: 'N', run: newEventNow },
    { id: 'new-task', icon: 'tasks', label: 'New task', hint: 'Capture something to do', keys: '⇧N', run: () => openTaskModal({}) },
    { id: 'planner', icon: 'calendar', label: 'Go to planner', hint: 'Week view', run: () => store.setUi({ view: 'week' }) },
    { id: 'tasks', icon: 'tasks', label: 'Go to tasks', hint: 'Task inbox', run: () => store.setUi({ view: 'tasks' }) },
    { id: 'notes', icon: 'note', label: 'Go to notes', hint: 'Daily journal', run: () => store.setUi({ view: 'notes' }) },
    { id: 'focus', icon: 'timer', label: 'Go to focus', hint: 'Start a deep work block', run: () => store.setUi({ view: 'focus' }) },
    { id: 'stats', icon: 'chart', label: 'Go to insights', hint: 'Your week in numbers', run: () => store.setUi({ view: 'stats' }) },
    { id: 'today', icon: 'target', label: 'Jump to today', hint: 'Reset the planner to this week', run: () => {
      const s = store.get();
      store.setUi({
        weekStart: dateKey(startOfWeek(new Date(), s.settings.weekStart)),
        dayDate: dateKey(new Date()),
        view: 'week',
      });
    } },
    { id: 'next-week', icon: 'chevronRight', label: 'Next week', hint: 'Move the planner forward', run: () => {
      const s = store.get();
      const start = parseKey(s.ui.weekStart) || startOfWeek(new Date(), s.settings.weekStart);
      store.setUi({ weekStart: dateKey(addDays(start, 7)) });
    } },
    { id: 'prev-week', icon: 'chevronLeft', label: 'Previous week', hint: 'Move the planner back', run: () => {
      const s = store.get();
      const start = parseKey(s.ui.weekStart) || startOfWeek(new Date(), s.settings.weekStart);
      store.setUi({ weekStart: dateKey(addDays(start, -7)) });
    } },
    { id: 'theme', icon: 'moon', label: 'Toggle theme', hint: 'Light ↔ dark', run: () => {
      const s = store.get();
      const resolved = s.settings.theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
        : s.settings.theme;
      store.mutate((st) => {
        st.settings.theme = resolved === 'light' ? 'dark' : 'light';
      }, { history: false });
    } },
    { id: 'auto-schedule', icon: 'sparkles', label: 'Auto-schedule next task', hint: 'Drop the next unscheduled task into a free slot', run: () => {
      const task = store.unscheduledTasks(store.get()).find((t) => !t.done);
      if (task) scheduleTask(task.id);
      else toast('Nothing left to schedule', { type: 'info' });
    } },
    { id: 'print', icon: 'printer', label: 'Print week', hint: 'Show the timetable on paper', run: () => {
      store.setUi({ view: 'week' });
      setTimeout(() => window.print(), 250);
    } },
    { id: 'export', icon: 'download', label: 'Export backup', hint: 'Download all data as JSON', run: () => {
      downloadFile(`tempo-backup-${dateKey(new Date())}.json`, store.exportPayload(), 'application/json');
      toast('Backup downloaded', { type: 'success' });
    } },
    { id: 'shortcuts', icon: 'command', label: 'Keyboard shortcuts', hint: 'See every shortcut', run: openShortcuts },
  ];
}

function searchRecords(query) {
  const state = store.get();
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results = [];

  for (const event of state.events) {
    if (!event.title.toLowerCase().includes(q)) continue;
    const date = nextDateFor(event);
    results.push({
      icon: 'calendar',
      label: event.title,
      hint: `${event.repeat === 'weekly' ? `Every ${DAY_SHORT[event.weekday]}` : formatShortDate(date)} · ${timeLabel(event.start, state.settings.hour24)}`,
      run: () => openEventModal({ event, date }),
    });
  }
  for (const task of state.tasks) {
    if (!(task.title.toLowerCase().includes(q) || (task.notes || '').toLowerCase().includes(q))) continue;
    results.push({
      icon: 'tasks',
      label: task.title,
      hint: task.done ? 'Completed task' : task.due ? `Due ${formatShortDate(parseKey(task.due))}` : 'Task',
      run: () => openTaskModal({ task }),
    });
  }
  for (const [key, text] of Object.entries(state.notes)) {
    if (!String(text).toLowerCase().includes(q)) continue;
    const snippet = String(text).replace(/\s+/g, ' ').slice(0, 60);
    results.push({
      icon: 'note',
      label: `Note · ${formatShortDate(parseKey(key))}`,
      hint: snippet,
      run: () => store.setUi({ view: 'notes', noteDate: key }),
    });
  }
  return results.slice(0, 12);
}

export function openShortcuts() {
  const rows = [
    ['⌘ K', 'Command palette'],
    ['N', 'New event'],
    ['⇧ N', 'New task'],
    ['T', 'Jump to today'],
    ['← / →', 'Previous / next week'],
    ['⌘ Z', 'Undo'],
    ['⇧ ⌘ Z', 'Redo'],
    ['?', 'This help'],
    ['Esc', 'Close dialogs'],
  ];
  openModal({
    title: 'Keyboard shortcuts',
    subtitle: 'Work faster without the mouse',
    size: 'sm',
    body: `<div class="shortcut-list">${rows
      .map(([keys, label]) => `<div class="shortcut-row"><span class="shortcut-keys">${keys
        .split(' ')
        .map((k) => `<kbd>${esc(k)}</kbd>`)
        .join('')}</span><span>${esc(label)}</span></div>`)
      .join('')}</div>`,
    footer: '',
  });
}

export function openPalette() {
  if (document.querySelector('.palette-backdrop')) return;
  const wrap = document.createElement('div');
  wrap.className = 'palette-backdrop';
  wrap.innerHTML = `
    <div class="palette" role="dialog" aria-modal="true" aria-label="Command palette">
      <div class="palette-input-row">
        ${icon('search')}
        <input class="palette-input" type="text" placeholder="Search events, tasks, notes — or run a command" autocomplete="off" spellcheck="false">
        <kbd class="palette-esc">esc</kbd>
      </div>
      <div class="palette-results"></div>
      <div class="palette-foot"><span>↑↓ navigate</span><span>↵ select</span><span class="palette-foot-brand">Tempo</span></div>
    </div>`;
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('is-open'));

  const input = wrap.querySelector('.palette-input');
  const resultsEl = wrap.querySelector('.palette-results');
  let items = [];
  let selected = 0;

  const close = () => {
    wrap.classList.remove('is-open');
    setTimeout(() => wrap.remove(), 140);
    document.removeEventListener('keydown', onKey, true);
  };

  const runItem = (item) => {
    if (!item) return;
    close();
    setTimeout(() => item.run(), 10);
  };

  const renderList = () => {
    const query = input.value.trim();
    const cmds = commands().filter((c) => !query || c.label.toLowerCase().includes(query.toLowerCase()) || c.hint.toLowerCase().includes(query.toLowerCase()));
    const records = searchRecords(query);
    items = [...cmds, ...records];
    if (selected >= items.length) selected = Math.max(0, items.length - 1);
    const cmdCount = cmds.length;
    resultsEl.innerHTML = items.length
      ? `${cmds.length ? `<div class="palette-group">Commands</div>` : ''}
         ${cmds
          .map(
            (cmd, i) => `
            <button type="button" class="palette-item ${selected === i ? 'is-selected' : ''}" data-index="${i}">
              <span class="palette-icon">${ICON[cmd.icon] || ''}</span>
              <span class="palette-text"><span class="palette-label">${esc(cmd.label)}</span><span class="palette-hint">${esc(cmd.hint)}</span></span>
              ${cmd.keys ? `<kbd class="palette-key">${esc(cmd.keys)}</kbd>` : ''}
            </button>`,
          )
          .join('')}
         ${records.length ? `<div class="palette-group">Results</div>` : ''}
         ${records
          .map(
            (rec, j) => `
            <button type="button" class="palette-item ${selected === cmdCount + j ? 'is-selected' : ''}" data-index="${cmdCount + j}">
              <span class="palette-icon">${ICON[rec.icon] || ''}</span>
              <span class="palette-text"><span class="palette-label">${esc(rec.label)}</span><span class="palette-hint">${esc(rec.hint)}</span></span>
            </button>`,
          )
          .join('')}`
      : `<div class="palette-empty">No matches for “${esc(query)}”</div>`;

    resultsEl.querySelectorAll('.palette-item').forEach((el) => {
      el.addEventListener('mouseenter', () => {
        selected = Number(el.dataset.index);
        resultsEl.querySelectorAll('.palette-item').forEach((x) => x.classList.toggle('is-selected', x === el));
      });
      el.addEventListener('click', () => runItem(items[Number(el.dataset.index)]));
    });
    const active = resultsEl.querySelector('.is-selected');
    if (active) active.scrollIntoView({ block: 'nearest' });
  };

  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      selected = Math.min(items.length - 1, selected + 1);
      renderList();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selected = Math.max(0, selected - 1);
      renderList();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runItem(items[selected]);
    }
  };

  input.addEventListener('input', () => {
    selected = 0;
    renderList();
  });
  wrap.addEventListener('mousedown', (e) => {
    if (e.target === wrap) close();
  });
  document.addEventListener('keydown', onKey, true);
  renderList();
  input.focus();
}
