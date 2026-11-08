/* App shell: navigation, topbar, shortcuts and reminder engine. */

import * as store from './store.js';
import { ICON, icon, toast, beep } from './ui.js';
import { renderWeek } from './views/week.js?v=6';
import { renderTasks } from './views/tasks.js';
import { renderNotes } from './views/notes.js?v=7';
import { renderFocus, isFocusTimerRunning } from './views/focus.js';
import { renderStats } from './views/stats.js';
import { renderSettings } from './views/settings.js';
import { openPalette, openShortcuts } from './palette.js';
import { openEventModal } from './event-modal.js';
import { openTaskModal } from './task-modal.js';
import {
  dateKey, parseKey, addDays, startOfWeek, weekDates, durationLabel, clamp,
  snapMinutes, greeting, DAY_SHORT, timeLabel, formatLongDate,
} from './util.js';

const viewRoot = document.getElementById('view');
const sidebar = document.getElementById('sidebar');
const scrim = document.getElementById('sidebarScrim');

const NAV = [
  { id: 'week', match: ['week', 'day', 'agenda'], label: 'Planner', icon: 'calendar' },
  { id: 'tasks', label: 'Tasks', icon: 'tasks' },
  { id: 'notes', label: 'Notes', icon: 'note' },
  { id: 'focus', label: 'Focus', icon: 'timer' },
  { id: 'stats', label: 'Insights', icon: 'chart' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

let lastView = null;

function applyTheme(state) {
  const s = state.settings;
  const resolved = s.theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : s.theme;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.accent = s.accent;
  document.documentElement.style.setProperty('--accent', store.COLORS[s.accent] || store.COLORS.indigo);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'light' ? '#f4f6fb' : '#080b11');
}

function weekSummary(state) {
  const dates = weekDates(startOfWeek(new Date(), state.settings.weekStart), state.settings.showWeekends ? 7 : 5);
  const map = store.weekInstancesMap(state, dates);
  const minutes = dates.reduce((sum, d) => sum + store.scheduledMinutes(map[dateKey(d)]), 0);
  const focus = state.focusSessions
    .filter((x) => x.date >= dateKey(dates[0]) && x.date <= dateKey(dates[dates.length - 1]))
    .reduce((sum, x) => sum + x.minutes, 0);
  return { minutes, focus };
}

function renderSidebar(state) {
  const today = new Date();
  const snap = store.todaySnapshot(state);
  const openTasks = state.tasks.filter((t) => !t.done).length;
  const summary = weekSummary(state);
  const view = state.ui.view;
  const name = state.settings.name;

  sidebar.innerHTML = `
    <div class="sidebar-top">
      <div class="brand">
        <span class="brand-mark">
          <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect x="3" y="6" width="26" height="23" rx="6" stroke="currentColor" stroke-width="2"/>
            <path d="M3 12h26M10 3v6M22 3v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M9 17h5M9 22h9M18 17h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </span>
        <span class="brand-name">Tempo</span>
      </div>
      <button type="button" class="icon-btn sidebar-close" data-sidebar-close aria-label="Close menu">${ICON.x}</button>
    </div>

    <div class="sidebar-today">
      <div class="st-eyebrow">${greeting(today)}${name ? `, ${name}` : ''}</div>
      <div class="st-date">${today.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
      <div class="st-stats">
        <span><strong>${snap.instances.length}</strong> blocks</span>
        <span><strong>${snap.openTasks}</strong> open</span>
        <span><strong>${snap.focusToday ? durationLabel(snap.focusToday) : '0m'}</strong> focus</span>
      </div>
      ${snap.dueToday ? `<button type="button" class="st-alert" data-nav="tasks">${icon('alert')} ${snap.dueToday} due today</button>` : ''}
    </div>

    <nav class="nav">
      ${NAV.map((item) => {
        const active = item.match ? item.match.includes(view) : view === item.id;
        let badge = '';
        if (item.id === 'tasks' && openTasks) badge = `<span class="nav-badge">${openTasks}</span>`;
        if (item.id === 'focus' && isFocusTimerRunning()) badge = `<span class="nav-live"></span>`;
        return `<button type="button" class="nav-item ${active ? 'is-active' : ''}" data-nav="${item.id}">
          ${icon(item.icon)}<span class="nav-label">${item.label}</span>${badge}
        </button>`;
      }).join('')}
    </nav>

    <div class="sidebar-card">
      <div class="sc-head"><span>This week</span><span class="sc-range">${DAY_SHORT[addDays(startOfWeek(today, state.settings.weekStart), 0).getDay()]} – ${DAY_SHORT[addDays(startOfWeek(today, state.settings.weekStart), state.settings.showWeekends ? 6 : 4).getDay()]}</span></div>
      <div class="sc-row"><span>${icon('calendar')} Scheduled</span><strong>${durationLabel(summary.minutes)}</strong></div>
      <div class="sc-row"><span>${icon('tasks')} Tasks open</span><strong>${openTasks}</strong></div>
      <div class="sc-row"><span>${icon('timer')} Focus</span><strong>${durationLabel(summary.focus)}</strong></div>
      <div class="sc-bar"><span style="width:${Math.min(100, (summary.minutes / (40 * 60)) * 100)}%"></span></div>
    </div>

    <button type="button" class="sidebar-search" data-palette>
      ${icon('search')}<span>Search or jump</span><kbd>⌘K</kbd>
    </button>

    <div class="sidebar-foot">
      <span class="sidebar-dot"></span>
      <span>Saved on this device</span>
    </div>`;

  sidebar.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      store.setUi({ view: btn.dataset.nav });
      closeSidebar();
    });
  });
  sidebar.querySelector('[data-palette]')?.addEventListener('click', () => {
    closeSidebar();
    openPalette();
  });
  sidebar.querySelector('[data-sidebar-close]')?.addEventListener('click', closeSidebar);
}

function updateTopbar(state) {
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  if (undoBtn) undoBtn.disabled = !store.canUndo();
  if (redoBtn) redoBtn.disabled = !store.canRedo();
  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn) {
    const resolved = document.documentElement.dataset.theme;
    themeBtn.innerHTML = resolved === 'light' ? ICON.moon : ICON.sun;
    themeBtn.title = resolved === 'light' ? 'Switch to dark theme' : 'Switch to light theme';
  }
}

function render() {
  const state = store.get();
  applyTheme(state);
  renderSidebar(state);
  updateTopbar(state);
  const view = state.ui.view;
  const planner = ['week', 'day', 'agenda'].includes(view);
  viewRoot.classList.toggle('is-fill', planner);
  try {
    if (planner) renderWeek(viewRoot, state);
    else if (view === 'tasks') renderTasks(viewRoot, state);
    else if (view === 'notes') renderNotes(viewRoot, state);
    else if (view === 'focus') renderFocus(viewRoot, state);
    else if (view === 'stats') renderStats(viewRoot, state);
    else renderSettings(viewRoot, state);
  } catch (err) {
    console.error(err);
    viewRoot.innerHTML = `<div class="page"><div class="empty-state card">${icon('alert')}<p>Something went wrong rendering this view.</p><button class="btn" data-recover>Reload</button></div></div>`;
    viewRoot.querySelector('[data-recover]')?.addEventListener('click', () => window.location.reload());
  }
  if (lastView !== view) {
    viewRoot.scrollTop = 0;
    lastView = view;
  }
}

function closeSidebar() {
  sidebar.classList.remove('is-open');
  if (scrim) scrim.hidden = true;
}

function openSidebar() {
  sidebar.classList.add('is-open');
  if (scrim) scrim.hidden = false;
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

function jumpToday() {
  const s = store.get().settings;
  store.setUi({
    weekStart: dateKey(startOfWeek(new Date(), s.weekStart)),
    dayDate: dateKey(new Date()),
    view: ['day', 'agenda'].includes(store.get().ui.view) ? store.get().ui.view : 'week',
  });
}

function navigateWeek(dir) {
  const state = store.get();
  if (!['week', 'day', 'agenda', 'stats'].includes(state.ui.view)) return;
  if (state.ui.view === 'day') {
    store.setUi({ dayDate: dateKey(addDays(parseKey(state.ui.dayDate) || new Date(), dir)) });
    return;
  }
  const start = parseKey(state.ui.weekStart) || startOfWeek(new Date(), state.settings.weekStart);
  store.setUi({ weekStart: dateKey(addDays(start, dir * 7)) });
}

function toggleTheme() {
  const state = store.get();
  const current = document.documentElement.dataset.theme;
  store.mutate((st) => {
    st.settings.theme = current === 'light' ? 'dark' : 'light';
  }, { history: false });
}

function isTyping() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/* ----------------------------------------------------------- reminders */

const FIRED_KEY = 'tempo.fired-reminders.v1';
let fired = new Set();
try {
  fired = new Set(JSON.parse(localStorage.getItem(FIRED_KEY) || '[]'));
} catch {
  fired = new Set();
}

function checkReminders() {
  const state = store.get();
  if (!state.settings.notifications) return;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const today = dateKey(now);
  let changed = false;
  for (const inst of store.instancesForDate(state, now)) {
    const reminder = inst.event.reminder;
    if (reminder == null) continue;
    const at = inst.start - Number(reminder);
    const key = `${inst.key}#${today}#${at}`;
    if (fired.has(key)) continue;
    if (mins >= at && mins < at + 2) {
      fired.add(key);
      changed = true;
      const label = `${timeLabel(inst.start, state.settings.hour24)} · ${inst.event.title}`;
      if (window.Notification && Notification.permission === 'granted') {
        try {
          new Notification('Starting soon', { body: label, tag: inst.key });
        } catch {
          /* ignore */
        }
      }
      toast(`Starting soon — ${label}`, { type: 'info', duration: 6000 });
      beep(720, 0.14);
    }
  }
  if (changed) {
    const kept = Array.from(fired).slice(-400);
    fired = new Set(kept);
    try {
      localStorage.setItem(FIRED_KEY, JSON.stringify(kept));
    } catch {
      /* ignore */
    }
  }
}

/* ---------------------------------------------------------------- init */

document.getElementById('menuBtn')?.addEventListener('click', openSidebar);
if (scrim) scrim.addEventListener('click', closeSidebar);
document.getElementById('searchBtn')?.addEventListener('click', () => {
  openPalette();
});
document.getElementById('themeBtn')?.addEventListener('click', toggleTheme);
document.getElementById('undoBtn')?.addEventListener('click', () => {
  if (store.undo()) toast('Undone', { type: 'info' });
});
document.getElementById('redoBtn')?.addEventListener('click', () => {
  if (store.redo()) toast('Redone', { type: 'info' });
});

document.getElementById('menuBtn').innerHTML = ICON.menu;
document.getElementById('undoBtn').innerHTML = ICON.undo;
document.getElementById('redoBtn').innerHTML = ICON.redo;
document.getElementById('themeBtn').innerHTML = ICON.sun;

document.addEventListener('keydown', (e) => {
  const meta = e.metaKey || e.ctrlKey;
  const typing = isTyping();

  if (meta && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openPalette();
    return;
  }
  if (meta && e.key.toLowerCase() === 'z' && !typing) {
    e.preventDefault();
    if (e.shiftKey) {
      if (store.redo()) toast('Redone', { type: 'info' });
    } else if (store.undo()) {
      toast('Undone', { type: 'info' });
    }
    return;
  }
  if (typing) return;
  if (document.querySelector('.palette-backdrop')) return;
  if (document.querySelector('.modal-backdrop')) return;

  if (e.key === '?') {
    e.preventDefault();
    openShortcuts();
  } else if (e.key === 'n' || e.key === 'N') {
    if (e.shiftKey) openTaskModal({});
    else newEventNow();
  } else if (e.key === 't' || e.key === 'T') {
    jumpToday();
  } else if (e.key === 'ArrowLeft') {
    if (['week', 'day', 'agenda', 'stats'].includes(store.get().ui.view)) navigateWeek(-1);
  } else if (e.key === 'ArrowRight') {
    if (['week', 'day', 'agenda', 'stats'].includes(store.get().ui.view)) navigateWeek(1);
  }
});

window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  if (store.get().settings.theme === 'system') applyTheme(store.get());
});

store.subscribe(render);
render();
setInterval(checkReminders, 30000);
setTimeout(checkReminders, 3000);
