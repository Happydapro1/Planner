/* Week / day timetable grid and agenda view. */

import * as store from '../store.js';
import { icon, pageHead, toast } from '../ui.js';
import { openEventModal } from '../event-modal.js?v=6';
import { openTaskModal } from '../task-modal.js';
import { scheduleTask } from '../schedule.js';
import {
  dateKey, parseKey, addDays, startOfWeek, timeLabel, durationLabel, esc, formatRange,
  isToday, clamp, snapMinutes, greeting, formatLongDate, DAY_SHORT, DAY_NAMES,
  formatShortDate, minutesNow,
} from '../util.js';

const HOUR_H = 56;
const instByKey = new Map();
let savedScroll = null;
let lastContext = '';
let dragState = null;
let dragTaskId = null;
let suppressClickUntil = 0;

const DEFAULT_TITLE = document.title;

function printTitle(state) {
  const dates = store.displayedDates(state);
  const start = dates[0];
  const end = dates[dates.length - 1];
  if (state.ui.view === 'day') return `Tempo — ${formatLongDate(start)}`;
  if (state.ui.view === 'agenda') return `Tempo — Agenda · ${formatRange(start, end)}`;
  return `Tempo — Week of ${formatShortDate(start)}, ${start.getFullYear()}`;
}

/* Give the printer a sensible document title (browser headers/footers use it). */
window.addEventListener('beforeprint', () => {
  const state = store.get();
  if (['week', 'day', 'agenda'].includes(state.ui.view)) document.title = printTitle(state);
});
window.addEventListener('afterprint', () => {
  document.title = DEFAULT_TITLE;
});

function shift(view, dir) {
  const state = store.get();
  if (state.ui.view === 'day') {
    const d = addDays(parseKey(state.ui.dayDate) || new Date(), dir);
    store.setUi({ dayDate: dateKey(d) });
  } else {
    const start = addDays(parseKey(state.ui.weekStart) || startOfWeek(new Date(), state.settings.weekStart), dir * 7);
    store.setUi({ weekStart: dateKey(start) });
  }
}

function goToday() {
  const state = store.get();
  store.setUi({
    weekStart: dateKey(startOfWeek(new Date(), state.settings.weekStart)),
    dayDate: dateKey(new Date()),
  });
}

function positions(start, end, settings) {
  const total = settings.dayEnd - settings.dayStart;
  return {
    top: `${((start - settings.dayStart) / total) * 100}%`,
    height: `${Math.max(2, ((end - start) / total) * 100)}%`,
  };
}

function setPreview(el, start, end, settings) {
  const { top, height } = positions(start, end, settings);
  el.style.top = top;
  el.style.height = height;
  el.hidden = false;
}

/* Pack overlapping events into columns so they sit side by side. */
function layoutDay(instances) {
  const items = instances.map((i) => ({ ...i }));
  const clusters = [];
  let current = [];
  let clusterEnd = -1;
  for (const item of items) {
    if (current.length && item.start >= clusterEnd) {
      clusters.push(current);
      current = [];
      clusterEnd = -1;
    }
    current.push(item);
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  if (current.length) clusters.push(current);

  for (const cluster of clusters) {
    const columnEnds = [];
    for (const item of cluster) {
      let col = columnEnds.findIndex((end) => end <= item.start);
      if (col === -1) {
        col = columnEnds.length;
        columnEnds.push(item.end);
      } else {
        columnEnds[col] = item.end;
      }
      item.col = col;
    }
    cluster.forEach((item) => {
      item.cols = columnEnds.length;
    });
  }
  return items;
}

function eventMarkup(inst, settings) {
  const { top, height } = positions(inst.start, inst.end, settings);
  const width = 100 / inst.cols;
  const left = inst.col * width;
  const color = store.catColor(inst.event.catId);
  const minutes = inst.end - inst.start;
  const sizeClass = minutes <= 30 ? 'is-tiny' : minutes <= 45 ? 'is-short' : '';
  const category = store.categoryById(inst.event.catId);
  const linked = inst.event.taskId ? `<span class="ev-task" title="Linked task">${icon('tasks')}</span>` : '';
  const repeat = inst.event.repeat === 'weekly' ? '<span class="ev-repeat" title="Repeats weekly">↻</span>' : '';
  return `
    <div class="ev ${sizeClass}" data-inst="${esc(inst.key)}" data-eid="${esc(inst.id)}"
      style="top:${top};height:${height};left:calc(${left}% + 3px);width:calc(${width}% - 6px);--cat:${color}"
      role="button" tabindex="0" aria-label="${esc(inst.event.title)}, ${timeLabel(inst.start, settings.hour24)} to ${timeLabel(inst.end, settings.hour24)}">
      <div class="ev-bar"></div>
      <div class="ev-main">
        <div class="ev-top">
          <span class="ev-time">${timeLabel(inst.start, settings.hour24)}–${timeLabel(inst.end, settings.hour24)}</span>
          ${linked}${repeat}
        </div>
        <div class="ev-title">${esc(inst.event.title)}</div>
        ${inst.event.location ? `<div class="ev-loc">${icon('mapPin')}<span>${esc(inst.event.location)}</span></div>` : ''}
        ${category ? `<div class="ev-cat">${esc(category.name)} · ${durationLabel(minutes)}</div>` : ''}
      </div>
      <div class="ev-resize" data-resize aria-hidden="true"></div>
    </div>`;
}

function trayMarkup(state) {
  const tasks = store.unscheduledTasks(state);
  const hour24 = state.settings.hour24;
  return `
    <aside class="tray ${state.ui.trayOpen ? '' : 'is-collapsed'}">
      <div class="tray-head">
        <div class="tray-title">${icon('inbox')} Unscheduled</div>
        <span class="tray-count">${tasks.length}</span>
      </div>
      <p class="tray-hint">Drag a task onto the grid to time-block it.</p>
      <div class="tray-list">
        ${tasks.length
          ? tasks
            .map((t) => {
              const cat = store.categoryById(t.catId);
              return `
                <div class="tray-task" draggable="true" data-task="${t.id}" title="Drag to schedule ${esc(t.title)}">
                  <span class="tray-grip">${icon('grip')}</span>
                  <span class="tray-task-main">
                    <span class="tray-task-title">${esc(t.title)}</span>
                    <span class="tray-task-meta">
                      ${cat ? `<i class="dot" style="--cat:${store.catColor(cat.id)}"></i>${esc(cat.name)}` : 'No category'}
                      · ${durationLabel(t.estMins || 60)}
                      ${t.due ? ` · due ${formatShortDate(parseKey(t.due))}` : ''}
                    </span>
                  </span>
                  <button type="button" class="icon-btn icon-btn-sm" data-tray-schedule="${t.id}" title="Auto-schedule">${icon('sparkles')}</button>
                </div>`;
            })
            .join('')
          : `<div class="tray-empty">${icon('check')}<span>Everything is scheduled.</span></div>`}
      </div>
      <div class="tray-foot">
        <button type="button" class="btn btn-sm btn-block" data-new-task>${icon('plus')} New task</button>
      </div>
      <span class="tray-hidden-clock" data-clock>${timeLabel(Math.floor(minutesNow() / 30) * 30, hour24)}</span>
    </aside>`;
}

function agendaMarkup(state, dates) {
  const hour24 = state.settings.hour24;
  const map = store.weekInstancesMap(state, dates);
  const dueByDay = new Map();
  for (const t of state.tasks) {
    if (!t.due || t.done) continue;
    if (!dueByDay.has(t.due)) dueByDay.set(t.due, []);
    dueByDay.get(t.due).push(t);
  }
  const rows = dates
    .map((date) => {
      const key = dateKey(date);
      const instances = map[key].filter((i) => !state.ui.hiddenCats.includes(i.event.catId));
      const dueTasks = dueByDay.get(key) || [];
      const mins = instances.reduce((sum, i) => sum + (i.end - i.start), 0);
      return `
        <div class="agenda-day ${isToday(date) ? 'is-today' : ''}">
          <div class="agenda-date">
            <span class="agenda-dow">${DAY_SHORT[date.getDay()]}</span>
            <span class="agenda-daynum">${date.getDate()}</span>
            <span class="agenda-month">${date.toLocaleDateString(undefined, { month: 'short' })}</span>
            <span class="agenda-mins">${mins ? durationLabel(mins) : 'free'}</span>
          </div>
          <div class="agenda-items">
            ${instances.length
              ? instances
                .map((inst) => {
                  const cat = store.categoryById(inst.event.catId);
                  return `
                    <button type="button" class="agenda-item" data-edit-inst="${inst.key}">
                      <span class="agenda-time">${timeLabel(inst.start, hour24)}<small>${timeLabel(inst.end, hour24)}</small></span>
                      <span class="agenda-dot" style="--cat:${store.catColor(inst.event.catId)}"></span>
                      <span class="agenda-body">
                        <span class="agenda-title">${esc(inst.event.title)}</span>
                        <span class="agenda-sub">${cat ? esc(cat.name) : 'No category'}${inst.event.location ? ` · ${esc(inst.event.location)}` : ''}</span>
                      </span>
                    </button>`;
                })
                .join('')
              : '<div class="agenda-empty">Nothing scheduled</div>'}
            ${dueTasks
              .map((t) => `<button type="button" class="agenda-task ${t.due === key ? '' : ''}" data-edit-task="${t.id}">
                ${icon('tasks')} <span>${esc(t.title)}</span><em>due</em></button>`)
              .join('')}
          </div>
        </div>`;
    })
    .join('');
  return `<div class="agenda">${rows}</div>`;
}

export function renderWeek(root, state) {
  const s = state.settings;
  const isDay = state.ui.view === 'day';
  const isAgenda = state.ui.view === 'agenda';
  const dates = store.displayedDates(state);
  const map = store.weekInstancesMap(state, dates);
  const visible = (list) => list.filter((i) => !state.ui.hiddenCats.includes(i.event.catId));
  const totalMin = dates.reduce((sum, d) => sum + store.scheduledMinutes(visible(map[dateKey(d)])), 0);
  const totalBlocks = dates.reduce((sum, d) => sum + visible(map[dateKey(d)]).length, 0);
  const start = dates[0];
  const end = dates[dates.length - 1];
  const hour24 = s.hour24;
  const context = `${state.ui.view}:${state.ui.weekStart}:${state.ui.dayDate}`;
  if (context !== lastContext) {
    lastContext = context;
    savedScroll = null;
  }

  const range = isDay ? formatLongDate(start) : formatRange(start, end);
  const eyebrow = state.settings.name ? `${greeting()}, ${state.settings.name}` : greeting();
  const headline = isDay
    ? `${DAY_NAMES[start.getDay()]} plan`
    : isAgenda ? 'Agenda' : 'Your week';
  const subtitle = `${totalBlocks} ${totalBlocks === 1 ? 'block' : 'blocks'} · ${durationLabel(totalMin)} scheduled · ${durationLabel(
    dates.reduce((sum, d) => sum + store.freeMinutesForDate(state, d), 0),
  )} free`;

  const hours = (s.dayEnd - s.dayStart) / 60;
  const hourMarks = [];
  for (let h = Math.ceil(s.dayStart / 60); h * 60 <= s.dayEnd; h += 1) hourMarks.push(h * 60);

  const dayHeads = dates
    .map((d) => {
      const key = dateKey(d);
      const dayBlocks = visible(map[key]).length;
      return `
        <button type="button" class="day-head ${isToday(d) ? 'is-today' : ''}" data-goto-day="${key}"
          title="Open ${DAY_NAMES[d.getDay()]} ${formatShortDate(d)}">
          <span class="day-head-name">${isDay ? DAY_NAMES[d.getDay()] : DAY_SHORT[d.getDay()]}</span>
          <span class="day-head-date">${d.getDate()}</span>
          <span class="day-head-meta">${dayBlocks ? `${dayBlocks} block${dayBlocks === 1 ? '' : 's'}` : 'open'}</span>
        </button>`;
    })
    .join('');

  const columns = dates
    .map((date) => {
      const key = dateKey(date);
      const instances = layoutDay(visible(map[key]));
      instances.forEach((inst) => instByKey.set(inst.key, inst));
      const now = new Date();
      const nowLine = isToday(date) && minutesNow() >= s.dayStart && minutesNow() <= s.dayEnd
        ? `<div class="now-line" style="top:${((minutesNow() - s.dayStart) / (s.dayEnd - s.dayStart)) * 100}%"><span></span></div>`
        : '';
      return `
        <div class="day-col ${isToday(date) ? 'is-today' : ''} ${[0, 6].includes(date.getDay()) ? 'is-weekend' : ''}"
          data-date="${key}" data-day="${date.getDay()}">
          ${nowLine}
          ${instances.map((inst) => eventMarkup(inst, s)).join('')}
        </div>`;
    })
    .join('');

  const hasBlocks = totalBlocks > 0;

  const html = `
    <section class="page page-week">
      <header class="print-head">
        <div class="print-brand">
          <span class="print-wordmark">Tempo</span>
          <span class="print-tagline">Timetable planner</span>
        </div>
        <div class="print-title-block">
          <h1>${esc(headline)}</h1>
          <p class="print-range">${esc(range)}</p>
        </div>
        <div class="print-meta">
          <span>${esc(subtitle)}</span>
          <span>Printed ${esc(formatLongDate(new Date()))}</span>
        </div>
      </header>

      <div class="print-legend">
        ${state.categories
          .map((c) => `<span class="print-legend-item"><i class="dot" style="--cat:${store.COLORS[c.color]}"></i>${esc(c.name)}</span>`)
          .join('')}
      </div>

      ${pageHead({
        eyebrow,
        title: headline,
        subtitle,
        actions: `
          <button type="button" class="btn btn-ghost" data-print>${icon('printer')} <span class="hide-sm">Print</span></button>
          <button type="button" class="btn btn-primary" data-new>${icon('plus')} New event</button>`,
      })}

      <div class="week-toolbar">
        <div class="week-nav">
          <button type="button" class="icon-btn" data-prev aria-label="Previous">${icon('chevronLeft')}</button>
          <button type="button" class="btn btn-sm" data-today>Today</button>
          <button type="button" class="icon-btn" data-next aria-label="Next">${icon('chevronRight')}</button>
          <span class="week-label">${esc(range)}</span>
        </div>
        <div class="week-meta">
          <input class="input input-sm date-jump" type="date" value="${dateKey(start)}" data-jump aria-label="Jump to date">
          <div class="segmented segmented-sm">
            <button type="button" data-mode="week" class="${state.ui.view === 'week' ? 'is-active' : ''}">Week</button>
            <button type="button" data-mode="day" class="${state.ui.view === 'day' ? 'is-active' : ''}">Day</button>
            <button type="button" data-mode="agenda" class="${state.ui.view === 'agenda' ? 'is-active' : ''}">Agenda</button>
          </div>
          <button type="button" class="icon-btn ${state.ui.trayOpen ? 'is-on' : ''}" data-tray-toggle title="Toggle task tray">${icon('inbox')}</button>
        </div>
      </div>

      <div class="cat-filter">
        <span class="cat-filter-label">${icon('filter')} Categories</span>
        ${state.categories
          .map((c) => {
            const hidden = state.ui.hiddenCats.includes(c.id);
            return `<button type="button" class="cat-chip ${hidden ? 'is-off' : ''}" data-cat="${c.id}" style="--cat:${store.COLORS[c.color]}">
              <i class="dot"></i>${esc(c.name)}</button>`;
          })
          .join('')}
        ${state.ui.hiddenCats.length ? `<button type="button" class="cat-reset" data-cat-reset>Show all</button>` : ''}
      </div>

      ${isAgenda
        ? `<div class="week-layout"><div class="agenda-shell card">${agendaMarkup(state, dates)}</div>${trayMarkup(state)}</div>`
        : `
      <div class="week-layout ${state.ui.trayOpen ? '' : 'is-tray-closed'}">
        <div class="week-shell">
          ${hasBlocks ? '' : `<div class="grid-hint">${icon('sparkles')} Click any empty slot to add a block · drag blocks to move · pull the bottom edge to resize</div>`}
          <div class="week-scroll" data-scroll>
            <div class="week-head" style="--days:${dates.length}">
              <div class="gutter-head"></div>
              <div class="day-heads">${dayHeads}</div>
            </div>
            <div class="week-body" style="--hour-h:${HOUR_H}px;--hours:${hours};--slot-h:${HOUR_H / (60 / s.slot)}px">
              <div class="time-ruler">
                ${hourMarks
                  .map(
                    (m) =>
                      `<div class="hour-label" style="--h:${(m - s.dayStart) / 60}">${timeLabel(m, hour24)}</div>`,
                  )
                  .join('')}
              </div>
              <div class="grid-body" style="--days:${dates.length}">${columns}</div>
            </div>
          </div>
        </div>
        ${trayMarkup(state)}
      </div>`}
    </section>`;

  root.innerHTML = html;
  mount(root, state, dates);
}

function mount(root, state, dates) {
  const s = state.settings;
  const gridBody = root.querySelector('.grid-body');
  const scrollEl = root.querySelector('.week-scroll');

  root.querySelector('[data-prev]')?.addEventListener('click', () => shift(state, -1));
  root.querySelector('[data-next]')?.addEventListener('click', () => shift(state, 1));
  root.querySelector('[data-today]')?.addEventListener('click', goToday);
  root.querySelector('[data-new]')?.addEventListener('click', () => {
    const base = state.ui.view === 'day' ? parseKey(state.ui.dayDate) : new Date();
    const now = new Date();
    const defaultStart = clamp(
      snapMinutes(Math.max(s.dayStart, now.getHours() * 60 + now.getMinutes()), s.slot),
      s.dayStart,
      s.dayEnd - s.defaultDuration,
    );
    openEventModal({ date: isToday(base) ? now : base, start: defaultStart, end: defaultStart + s.defaultDuration });
  });
  root.querySelector('[data-print]')?.addEventListener('click', () => window.print());
  root.querySelector('[data-jump]')?.addEventListener('change', (e) => {
    const value = e.target.value;
    if (!value) return;
    const d = parseKey(value);
    if (!d) return;
    if (state.ui.view === 'day') store.setUi({ dayDate: dateKey(d) });
    else store.setUi({ weekStart: dateKey(startOfWeek(d, s.weekStart)) });
  });
  root.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      const patch = { view: mode };
      if (mode === 'day' && !parseKey(state.ui.dayDate)) patch.dayDate = dateKey(new Date());
      store.setUi(patch);
    });
  });
  root.querySelector('[data-tray-toggle]')?.addEventListener('click', () => {
    store.setUi({ trayOpen: !state.ui.trayOpen });
  });
  root.querySelectorAll('[data-goto-day]').forEach((btn) => {
    btn.addEventListener('click', () => store.setUi({ view: 'day', dayDate: btn.dataset.gotoDay }));
  });
  root.querySelectorAll('[data-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.cat;
      const hidden = new Set(state.ui.hiddenCats);
      if (hidden.has(id)) hidden.delete(id);
      else hidden.add(id);
      store.setUi({ hiddenCats: Array.from(hidden) });
    });
  });
  root.querySelector('[data-cat-reset]')?.addEventListener('click', () => store.setUi({ hiddenCats: [] }));

  // Agenda actions
  root.querySelectorAll('[data-edit-inst]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const inst = instByKey.get(btn.dataset.editInst);
      if (inst) openEventModal({ event: inst.event, date: inst.date });
    });
  });
  root.querySelectorAll('[data-edit-task]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const task = state.tasks.find((t) => t.id === btn.dataset.editTask);
      if (task) openTaskModal({ task });
    });
  });

  // Task tray
  root.querySelectorAll('.tray-task').forEach((el) => {
    el.addEventListener('dragstart', (e) => {
      dragTaskId = el.dataset.task;
      el.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', `task:${dragTaskId}`);
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('is-dragging');
      dragTaskId = null;
      clearPreview(root);
    });
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-tray-schedule]')) return;
      const task = state.tasks.find((t) => t.id === el.dataset.task);
      if (task) openTaskModal({ task });
    });
  });
  root.querySelectorAll('[data-tray-schedule]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      scheduleTask(btn.dataset.traySchedule);
    });
  });
  root.querySelector('[data-new-task]')?.addEventListener('click', () => openTaskModal({}));

  if (!gridBody) return;

  const restore = savedScroll;
  requestAnimationFrame(() => {
    if (!scrollEl) return;
    if (restore == null) {
      const target = ((Math.max(s.dayStart, 8 * 60) - s.dayStart) / 60) * HOUR_H - 18;
      scrollEl.scrollTop = Math.max(0, target);
    } else {
      scrollEl.scrollTop = restore;
    }
    savedScroll = scrollEl.scrollTop;
  });
  scrollEl?.addEventListener('scroll', () => {
    if (scrollEl) savedScroll = scrollEl.scrollTop;
  }, { passive: true });

  // Click empty slot → new event
  gridBody.addEventListener('click', (e) => {
    if (Date.now() < suppressClickUntil) return;
    if (e.target.closest('.ev') || e.target.closest('.now-line')) return;
    const col = e.target.closest('.day-col');
    if (!col) return;
    const date = parseKey(col.dataset.date);
    if (!date) return;
    const rect = col.getBoundingClientRect();
    const raw = s.dayStart + ((e.clientY - rect.top) / rect.height) * (s.dayEnd - s.dayStart);
    let start = clamp(snapMinutes(raw, s.slot), s.dayStart, s.dayEnd);
    let end = Math.min(s.dayEnd, start + s.defaultDuration);
    if (end - start < s.slot) {
      start = Math.max(s.dayStart, s.dayEnd - s.defaultDuration);
      end = s.dayEnd;
    }
    openEventModal({ date, start, end });
  });

  // Pointer gestures: move / resize
  gridBody.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const evEl = e.target.closest('.ev');
    if (!evEl) return;
    const inst = instByKey.get(evEl.dataset.inst);
    if (!inst) return;
    const rect = evEl.getBoundingClientRect();
    const resize = !!e.target.closest('[data-resize]');
    const grab = rect.height
      ? ((e.clientY - rect.top) / rect.height) * (inst.end - inst.start)
      : 0;
    dragState = {
      root, inst, evEl, resize, moved: false,
      startX: e.clientX, startY: e.clientY,
      grab: resize ? 0 : grab, target: null, settings: s,
    };
    e.preventDefault();
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragEnd, { once: true });
  });

  // Drag a task from the tray onto a slot
  gridBody.addEventListener('dragover', (e) => {
    if (!dragTaskId) return;
    const col = e.target.closest('.day-col');
    if (!col) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const task = state.tasks.find((t) => t.id === dragTaskId);
    const rect = col.getBoundingClientRect();
    const raw = s.dayStart + ((e.clientY - rect.top) / rect.height) * (s.dayEnd - s.dayStart);
    const start = clamp(snapMinutes(raw, s.slot), s.dayStart, s.dayEnd - Math.max(15, task?.estMins || s.defaultDuration));
    const end = Math.min(s.dayEnd, start + Math.max(s.slot, task?.estMins || s.defaultDuration));
    col.classList.add('is-drop-target');
    setPreview(getPreview(root, col), start, end, s);
  });
  gridBody.addEventListener('dragleave', (e) => {
    const col = e.target.closest('.day-col');
    if (col && !col.contains(e.relatedTarget)) {
      col.classList.remove('is-drop-target');
      clearPreview(root);
    }
  });
  gridBody.addEventListener('drop', (e) => {
    if (!dragTaskId) return;
    e.preventDefault();
    const col = e.target.closest('.day-col');
    const task = state.tasks.find((t) => t.id === dragTaskId);
    if (!col || !task) return;
    const rect = col.getBoundingClientRect();
    const raw = s.dayStart + ((e.clientY - rect.top) / rect.height) * (s.dayEnd - s.dayStart);
    const dur = Math.max(s.slot, task.estMins || s.defaultDuration);
    const start = clamp(snapMinutes(raw, s.slot), s.dayStart, s.dayEnd - dur);
    const date = parseKey(col.dataset.date);
    store.mutate((st) => {
      st.events.push({
        id: `ev_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        title: task.title,
        catId: task.catId,
        repeat: 'once',
        date: col.dataset.date,
        weekday: date.getDay(),
        start,
        end: start + dur,
        exdates: [],
        reminder: 10,
        location: '',
        notes: task.notes || '',
        taskId: task.id,
      });
    });
    dragTaskId = null;
    clearPreview(root);
    toast(`Scheduled: ${task.title}`, {
      type: 'success',
      action: { label: 'Undo', onClick: () => store.undo() },
    });
  });
}

function getPreview(root, col) {
  let el = col.querySelector('.drop-preview');
  if (!el) {
    el = document.createElement('div');
    el.className = 'drop-preview';
    col.appendChild(el);
  }
  return el;
}

function clearPreview(root) {
  root.querySelectorAll('.drop-preview').forEach((el) => el.remove());
  root.querySelectorAll('.is-drop-target').forEach((el) => el.classList.remove('is-drop-target'));
}

function onDragMove(e) {
  if (!dragState) return;
  const ds = dragState;
  if (!ds.moved && Math.hypot(e.clientX - ds.startX, e.clientY - ds.startY) < 5) return;
  ds.moved = true;
  const cols = Array.from(ds.root.querySelectorAll('.day-col'));
  const col = cols.find((c) => {
    const r = c.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right;
  }) || cols.find((c) => {
    const r = c.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right;
  });
  if (!col) return;
  const rect = col.getBoundingClientRect();
  const s = ds.settings;
  const raw = s.dayStart + ((e.clientY - rect.top) / rect.height) * (s.dayEnd - s.dayStart);
  const duration = ds.inst.end - ds.inst.start;
  let start = ds.inst.start;
  let end = ds.inst.end;
  if (ds.resize) {
    end = clamp(snapMinutes(raw, s.slot), start + s.slot, s.dayEnd);
  } else {
    start = clamp(snapMinutes(raw - ds.grab, s.slot), s.dayStart, s.dayEnd - duration);
    end = start + duration;
  }
  ds.target = { date: parseKey(col.dataset.date), start, end };
  ds.evEl.classList.add('is-dragging');
  cols.forEach((c) => c.classList.remove('is-drop-target'));
  col.classList.add('is-drop-target');
  setPreview(getPreview(ds.root, col), start, end, s);
}

function onDragEnd() {
  window.removeEventListener('pointermove', onDragMove);
  const ds = dragState;
  dragState = null;
  if (!ds) return;
  clearPreview(ds.root);
  ds.evEl.classList.remove('is-dragging');
  if (!ds.moved) {
    openEventModal({ event: ds.inst.event, date: ds.inst.date });
    return;
  }
  suppressClickUntil = Date.now() + 300;
  const target = ds.target;
  if (!target || !target.date) return;
  const s = ds.settings;
  store.mutate((st) => {
    const ev = st.events.find((x) => x.id === ds.inst.id);
    if (!ev) return;
    ev.start = target.start;
    ev.end = target.end;
    if (ev.repeat === 'weekly') ev.weekday = target.date.getDay();
    else {
      ev.date = dateKey(target.date);
      ev.weekday = target.date.getDay();
    }
  });
  const label = `${target.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}, ${timeLabel(target.start, s.hour24)}–${timeLabel(target.end, s.hour24)}`;
  toast(ds.inst.event.repeat === 'weekly' ? `Moved (all weeks): ${label}` : `Moved: ${label}`, {
    type: 'success',
    action: { label: 'Undo', onClick: () => store.undo() },
  });
}
