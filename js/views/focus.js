/* Focus timer with session logging, task linking and streaks. */

import * as store from '../store.js';
import { icon, pageHead, toast, beep } from '../ui.js';
import { uid, dateKey, addDays, timeLabel, esc, durationLabel, pluralize } from '../util.js';

const MODES = {
  work: { label: 'Focus', icon: 'target' },
  short: { label: 'Short break', icon: 'coffee' },
  long: { label: 'Long break', icon: 'coffee' },
};

const timer = {
  mode: 'work',
  total: 25 * 60,
  remaining: 25 * 60,
  running: false,
  endAt: 0,
  taskId: '',
};

let interval = null;
let activeRoot = null;

function durationFor(mode, s) {
  if (mode === 'short') return Math.max(1, Number(s.breakMins) || 5) * 60;
  if (mode === 'long') return Math.max(1, Number(s.longBreakMins) || 15) * 60;
  return Math.max(1, Number(s.workMins) || 25) * 60;
}

function mmss(seconds) {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, seconds) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function remainingNow() {
  if (!timer.running) return timer.remaining;
  return Math.max(0, Math.round((timer.endAt - Date.now()) / 1000));
}

function paint() {
  const remaining = remainingNow();
  const pct = timer.total ? ((timer.total - remaining) / timer.total) * 100 : 0;
  const els = activeRoot || document;
  const timeEl = els.querySelector('[data-timer-time]');
  const ring = els.querySelector('[data-timer-ring]');
  const sub = els.querySelector('[data-timer-sub]');
  const startBtn = els.querySelector('[data-start]');
  if (timeEl) timeEl.textContent = mmss(remaining);
  if (ring) ring.style.setProperty('--p', `${pct}%`);
  if (sub) sub.textContent = timer.running ? `${MODES[timer.mode].label.toLowerCase()} in progress` : `of ${Math.round(timer.total / 60)} min`;
  if (startBtn) {
    startBtn.innerHTML = timer.running
      ? `${icon('pause')} Pause`
      : `${icon('play')} ${remaining === timer.total ? 'Start' : 'Resume'}`;
    startBtn.classList.toggle('is-running', timer.running);
  }
  document.title = timer.running ? `${mmss(remaining)} · ${MODES[timer.mode].label} — Tempo` : 'Tempo — Timetable Planner';
}

function stopClock() {
  if (interval) clearInterval(interval);
  interval = null;
}

function startClock() {
  stopClock();
  if (!timer.running) return;
  interval = setInterval(() => {
    if (!timer.running) return;
    const left = remainingNow();
    if (left <= 0) completeSession();
    else paint();
  }, 250);
}

function notify(body) {
  try {
    if (window.Notification && Notification.permission === 'granted') {
      new Notification('Tempo', { body, tag: 'tempo-focus' });
    }
  } catch {
    /* notifications are optional */
  }
}

function completeSession() {
  const finishedMode = timer.mode;
  timer.running = false;
  timer.remaining = 0;
  stopClock();
  beep(880, 0.18);
  setTimeout(() => beep(1180, 0.22), 220);

  if (finishedMode === 'work') {
    const state = store.get();
    const task = state.tasks.find((t) => t.id === timer.taskId);
    const minutes = Math.round(timer.total / 60);
    store.mutate((st) => {
      st.focusSessions.push({
        id: uid('focus'),
        date: dateKey(new Date()),
        minutes,
        taskId: timer.taskId || '',
        catId: task ? task.catId : '',
        at: Date.now(),
      });
    });
    notify(`${minutes} minutes of focus logged. Time for a break.`);
    toast(`Focus complete — ${minutes} min logged`, { type: 'success' });
    setMode('short', true);
  } else {
    notify('Break over. Ready for another focus block?');
    toast('Break over — back to it', { type: 'info' });
    setMode('work', true);
  }
  paint();
}

function setMode(mode, force = false) {
  const state = store.get();
  if (timer.running && !force) {
    timer.running = false;
    stopClock();
  }
  timer.mode = mode;
  timer.total = durationFor(mode, state.settings);
  timer.remaining = timer.total;
  timer.running = false;
  timer.endAt = 0;
  paint();
}

function startPause() {
  if (timer.running) {
    timer.remaining = remainingNow();
    timer.running = false;
    timer.endAt = 0;
    stopClock();
    document.title = 'Tempo — Timetable Planner';
  } else {
    timer.endAt = Date.now() + timer.remaining * 1000;
    timer.running = true;
    startClock();
    beep(560, 0.08);
  }
  paint();
}

function resetTimer() {
  timer.running = false;
  stopClock();
  timer.total = durationFor(timer.mode, store.get().settings);
  timer.remaining = timer.total;
  timer.endAt = 0;
  document.title = 'Tempo — Timetable Planner';
  paint();
}

function logManual() {
  const state = store.get();
  const task = state.tasks.find((t) => t.id === timer.taskId);
  const minutes = Math.round(timer.total / 60);
  store.mutate((st) => {
    st.focusSessions.push({
      id: uid('focus'),
      date: dateKey(new Date()),
      minutes,
      taskId: timer.taskId || '',
      catId: task ? task.catId : '',
      at: Date.now(),
    });
  });
  toast(`Logged ${minutes} minutes`, { type: 'success', action: { label: 'Undo', onClick: () => store.undo() } });
}

function weekMinutes(state) {
  const start = dateKey(addDays(new Date(), -6));
  return state.focusSessions
    .filter((s) => s.date >= start)
    .reduce((sum, s) => sum + s.minutes, 0);
}

function streakOf(state) {
  const active = new Set();
  for (const s of state.focusSessions) if (s.minutes > 0) active.add(s.date);
  for (const t of state.tasks) if (t.done && t.doneAt) active.add(t.doneAt);
  let cursor = new Date();
  if (!active.has(dateKey(cursor))) cursor = addDays(cursor, -1);
  let streak = 0;
  while (active.has(dateKey(cursor)) && streak < 400) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function renderFocus(root, state) {
  const s = state.settings;
  const today = dateKey(new Date());
  const todays = state.focusSessions
    .filter((x) => x.date === today)
    .sort((a, b) => b.at - a.at);
  const todayMinutes = todays.reduce((sum, x) => sum + x.minutes, 0);
  const openTasks = state.tasks.filter((t) => !t.done);
  const presets = timer.mode === 'work' ? [15, 25, 50, 90] : [5, 10, 15, 30];
  const task = state.tasks.find((t) => t.id === timer.taskId);

  if (!timer.running) {
    const expected = durationFor(timer.mode, s);
    if (timer.remaining === timer.total && timer.total !== expected) {
      timer.total = expected;
      timer.remaining = expected;
    }
  }

  const html = `
    <section class="page page-focus">
      ${pageHead({
        eyebrow: 'Deep work',
        title: 'Focus',
        subtitle: `${durationLabel(todayMinutes)} focused today · ${pluralize(todays.length, 'session')}`,
        actions: `<button type="button" class="btn btn-ghost" data-log>${icon('plus')} Log ${Math.round(timer.total / 60)} min</button>`,
      })}
      <div class="focus-layout">
        <div class="focus-card card">
          <div class="segmented segmented-sm focus-modes">
            ${Object.entries(MODES)
              .map(
                ([mode, meta]) => `<button type="button" data-mode="${mode}" class="${timer.mode === mode ? 'is-active' : ''}">${esc(meta.label)}</button>`,
              )
              .join('')}
          </div>

          <div class="timer-ring" data-timer-ring style="--p:${((timer.total - remainingNow()) / timer.total) * 100}%">
            <div class="timer-ring-inner">
              <span class="timer-label">${icon(MODES[timer.mode].icon)} ${esc(MODES[timer.mode].label)}</span>
              <span class="timer-time" data-timer-time>${mmss(remainingNow())}</span>
              <span class="timer-sub" data-timer-sub>of ${Math.round(timer.total / 60)} min</span>
            </div>
          </div>

          <div class="focus-actions">
            <button type="button" class="btn btn-primary btn-lg ${timer.running ? 'is-running' : ''}" data-start>
              ${icon(timer.running ? 'pause' : 'play')} ${timer.running ? 'Pause' : timer.remaining === timer.total ? 'Start' : 'Resume'}
            </button>
            <button type="button" class="btn btn-lg" data-reset title="Reset timer">${icon('reset')} Reset</button>
          </div>

          <div class="focus-presets">
            <span class="focus-presets-label">Length</span>
            ${presets
              .map(
                (m) => `<button type="button" class="chip ${Math.round(timer.total / 60) === m ? 'is-active' : ''}" data-preset="${m}">${m} min</button>`,
              )
              .join('')}
          </div>

          <label class="field focus-task-field">
            <span class="field-label">Working on</span>
            <select class="select" data-task-select>
              <option value="">No specific task</option>
              ${openTasks.map((t) => `<option value="${t.id}" ${timer.taskId === t.id ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}
            </select>
          </label>
          ${task ? `<p class="focus-linked">${icon('tasks')} Logged sessions attach to “${esc(task.title)}”.</p>` : ''}
        </div>

        <div class="focus-side">
          <div class="mini-stat-grid">
            <div class="mini-stat card">
              <span class="mini-stat-label">Today</span>
              <strong>${durationLabel(todayMinutes)}</strong>
              <span class="mini-stat-foot">${pluralize(todays.length, 'session')}</span>
            </div>
            <div class="mini-stat card">
              <span class="mini-stat-label">Last 7 days</span>
              <strong>${durationLabel(weekMinutes(state))}</strong>
              <span class="mini-stat-foot">rolling total</span>
            </div>
            <div class="mini-stat card">
              <span class="mini-stat-label">Streak</span>
              <strong>${streakOf(state)}d</strong>
              <span class="mini-stat-foot">focus or tasks</span>
            </div>
          </div>

          <div class="card sessions-card">
            <div class="card-head">
              <h2>Today's sessions</h2>
              <span class="card-sub">${durationLabel(todayMinutes)}</span>
            </div>
            <div class="session-list">
              ${todays.length
                ? todays
                  .map((x) => {
                    const linked = state.tasks.find((t) => t.id === x.taskId);
                    return `
                    <div class="session-row">
                      <span class="session-icon">${icon('timer')}</span>
                      <span class="session-main">
                        <span class="session-title">${linked ? esc(linked.title) : 'Open focus'}</span>
                        <span class="session-sub">${new Date(x.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}${x.catId ? ` · ${esc(store.categoryById(x.catId)?.name || '')}` : ''}</span>
                      </span>
                      <span class="session-mins">${durationLabel(x.minutes)}</span>
                      <button type="button" class="icon-btn icon-btn-sm" data-del-session="${x.id}" title="Delete session">${icon('x')}</button>
                    </div>`;
                  })
                  .join('')
                : `<div class="empty-state compact">${icon('timer')}<p>No focus sessions yet today.<br>Start the timer — even 15 minutes counts.</p></div>`}
            </div>
          </div>

          <div class="card focus-tips">
            <div class="card-head"><h2>Make it stick</h2></div>
            <ul class="tips">
              <li>${icon('target')} Pick one task before you start.</li>
              <li>${icon('bell')} Mute notifications for the block.</li>
              <li>${icon('coffee')} Take the break — it is part of the method.</li>
              <li>${icon('calendar')} Time-block your focus sessions in the planner.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>`;

  root.innerHTML = html;
  activeRoot = root;

  root.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });
  root.querySelector('[data-start]')?.addEventListener('click', startPause);
  root.querySelector('[data-reset]')?.addEventListener('click', resetTimer);
  root.querySelector('[data-log]')?.addEventListener('click', logManual);

  root.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const minutes = Number(btn.dataset.preset);
      if (timer.running) {
        toast('Pause the timer before changing its length', { type: 'warn' });
        return;
      }
      const key = timer.mode === 'work' ? 'workMins' : timer.mode === 'short' ? 'breakMins' : 'longBreakMins';
      store.mutate((st) => {
        st.settings[key] = minutes;
      }, { history: false });
      timer.total = minutes * 60;
      timer.remaining = timer.total;
      paint();
      store.setUi({});
    });
  });

  root.querySelector('[data-task-select]')?.addEventListener('change', (e) => {
    timer.taskId = e.target.value;
    store.setUi({});
  });

  root.querySelectorAll('[data-del-session]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.delSession;
      store.mutate((st) => {
        st.focusSessions = st.focusSessions.filter((x) => x.id !== id);
      });
      toast('Session removed', { type: 'success', action: { label: 'Undo', onClick: () => store.undo() } });
    });
  });

  paint();
  if (timer.running) startClock();
}

export function isFocusTimerRunning() {
  return timer.running;
}
