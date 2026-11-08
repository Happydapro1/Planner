/* Weekly insights: load, categories, focus and planning health. */

import * as store from '../store.js';
import { icon, pageHead } from '../ui.js';
import {
  dateKey, parseKey, addDays, startOfWeek, weekDates, formatRange, durationLabel,
  isToday, DAY_SHORT, esc, pct, pluralize,
} from '../util.js';

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

function longestFreeGap(state, date) {
  const s = state.settings;
  const instances = store.instancesForDate(state, date).sort((a, b) => a.start - b.start);
  let cursor = s.dayStart;
  let best = 0;
  for (const inst of instances) {
    best = Math.max(best, inst.start - cursor);
    cursor = Math.max(cursor, inst.end);
  }
  best = Math.max(best, s.dayEnd - cursor);
  return best;
}

function countConflicts(state, dates) {
  let pairs = 0;
  let worst = 0;
  for (const date of dates) {
    const list = store.instancesForDate(state, date).sort((a, b) => a.start - b.start);
    let active = [];
    for (const inst of list) {
      active = active.filter((x) => x.end > inst.start);
      if (active.length) pairs += active.length;
      active.push(inst);
      worst = Math.max(worst, active.length);
    }
  }
  return { pairs, worst };
}

function statCard({ label, value, unit, iconName, foot, tone = '' }) {
  return `
    <div class="stat-card ${tone}">
      <div class="stat-card-head">
        <span class="stat-icon">${icon(iconName)}</span>
        <span class="stat-label">${label}</span>
      </div>
      <div class="stat-value">${value}${unit ? `<small>${unit}</small>` : ''}</div>
      <div class="stat-foot">${foot}</div>
    </div>`;
}

export function renderStats(root, state) {
  const s = state.settings;
  const start = parseKey(state.ui.weekStart) || startOfWeek(new Date(), s.weekStart);
  const dates = weekDates(start, s.showWeekends ? 7 : 5);
  const end = dates[dates.length - 1];
  const map = store.weekInstancesMap(state, dates);
  const today = dateKey(new Date());

  const dayTotals = dates.map((d) => ({
    date: d,
    key: dateKey(d),
    minutes: store.scheduledMinutes(map[dateKey(d)]),
    free: store.freeMinutesForDate(state, d),
  }));
  const totalMinutes = dayTotals.reduce((sum, d) => sum + d.minutes, 0);
  const freeMinutes = dayTotals.reduce((sum, d) => sum + d.free, 0);

  const prevStart = addDays(start, -7);
  const prevDates = weekDates(prevStart, dates.length);
  const prevMap = store.weekInstancesMap(state, prevDates);
  const prevTotal = prevDates.reduce((sum, d) => sum + store.scheduledMinutes(prevMap[dateKey(d)]), 0);
  const delta = totalMinutes - prevTotal;

  const focusSessions = state.focusSessions.filter((x) => x.date >= dateKey(start) && x.date <= dateKey(end));
  const focusMinutes = focusSessions.reduce((sum, x) => sum + x.minutes, 0);
  const doneThisWeek = state.tasks.filter((t) => t.done && t.doneAt >= dateKey(start) && t.doneAt <= dateKey(end));
  const openTasks = state.tasks.filter((t) => !t.done);
  const dueThisWeek = openTasks.filter((t) => t.due && t.due >= dateKey(start) && t.due <= dateKey(end));
  const totalDone = state.tasks.filter((t) => t.done).length;
  const completion = pct(totalDone, state.tasks.length);
  const { pairs: conflictPairs, worst } = countConflicts(state, dates);
  const streak = streakOf(state);

  const byCat = state.categories
    .map((cat) => {
      let minutes = 0;
      for (const d of dates) {
        for (const inst of map[dateKey(d)]) if (inst.event.catId === cat.id) minutes += inst.end - inst.start;
      }
      return { cat, minutes, target: (cat.target || 0) * 60 };
    })
    .sort((a, b) => b.minutes - a.minutes);
  const topCat = byCat[0] && byCat[0].minutes ? byCat[0] : null;
  const maxDay = Math.max(60, ...dayTotals.map((d) => d.minutes));
  const busiest = dayTotals.reduce((best, d) => (d.minutes > best.minutes ? d : best), dayTotals[0]);
  const freeGaps = dates.map((d) => ({ date: d, gap: longestFreeGap(state, d) }));
  const bestGap = freeGaps.reduce((best, g) => (g.gap > best.gap ? g : best), freeGaps[0]);

  const insights = [];
  if (busiest && busiest.minutes > 0) {
    insights.push({
      icon: 'calendar',
      tone: 'accent',
      text: `<strong>${busiest.date.toLocaleDateString(undefined, { weekday: 'long' })}</strong> is your busiest day with <strong>${durationLabel(busiest.minutes)}</strong> scheduled.`,
    });
  }
  if (topCat) {
    insights.push({
      icon: 'chart',
      tone: '',
      text: `<strong>${esc(topCat.cat.name)}</strong> takes the most time this week — ${durationLabel(topCat.minutes)}${topCat.target ? ` of a ${topCat.target / 60}h target` : ''}.`,
    });
  }
  if (conflictPairs) {
    insights.push({
      icon: 'alert',
      tone: 'warn',
      text: `${pluralize(conflictPairs, 'overlap')} in your timetable${worst > 2 ? `, up to ${worst} blocks at once` : ''}. Consider moving a block.`,
      action: { label: 'Open planner', view: 'week' },
    });
  }
  const overdue = openTasks.filter((t) => t.due && t.due < today);
  if (overdue.length) {
    insights.push({
      icon: 'flag',
      tone: 'danger',
      text: `<strong>${pluralize(overdue.length, 'task')}</strong> past the due date. Clear or reschedule them to keep momentum.`,
      action: { label: 'Review tasks', view: 'tasks' },
    });
  }
  if (dueThisWeek.length) {
    insights.push({
      icon: 'target',
      tone: '',
      text: `${pluralize(dueThisWeek.length, 'task')} due this week, and ${pluralize(openTasks.length - dueThisWeek.length, 'task')} without a date.`,
    });
  }
  if (bestGap && bestGap.gap >= 90) {
    insights.push({
      icon: 'clock',
      tone: 'good',
      text: `Biggest open stretch: <strong>${durationLabel(bestGap.gap)}</strong> on ${bestGap.date.toLocaleDateString(undefined, { weekday: 'long' })} — a good slot for deep work.`,
      action: { label: 'Plan it', view: 'week' },
    });
  }
  const behind = byCat.filter((c) => c.target && c.minutes < c.target * 0.5 && c.minutes >= 0 && c.cat.target > 0);
  if (behind.length && totalMinutes > 0) {
    insights.push({
      icon: 'target',
      tone: '',
      text: `Below half of target: ${behind.slice(0, 3).map((c) => esc(c.cat.name)).join(', ')}.`,
      action: { label: 'Targets', view: 'settings' },
    });
  }
  if (!insights.length) {
    insights.push({
      icon: 'sparkles',
      tone: 'good',
      text: 'A clean slate. Add a few blocks and this page fills with patterns.',
      action: { label: 'Open planner', view: 'week' },
    });
  }

  const html = `
    <section class="page page-stats">
      ${pageHead({
        eyebrow: 'Insights',
        title: 'Your week in numbers',
        subtitle: formatRange(start, end),
        actions: `
          <button type="button" class="icon-btn" data-prev aria-label="Previous week">${icon('chevronLeft')}</button>
          <button type="button" class="btn btn-sm" data-today>This week</button>
          <button type="button" class="icon-btn" data-next aria-label="Next week">${icon('chevronRight')}</button>`,
      })}

      <div class="stat-grid">
        ${statCard({
          label: 'Scheduled',
          value: durationLabel(totalMinutes) || '0m',
          iconName: 'calendar',
          foot: delta === 0 ? 'Same as last week' : `${delta > 0 ? '+' : '−'}${durationLabel(Math.abs(delta))} vs last week`,
          tone: 'is-accent',
        })}
        ${statCard({
          label: 'Free time',
          value: `${Math.round(freeMinutes / 60)}h`,
          iconName: 'clock',
          foot: `Across ${dates.length} days`,
        })}
        ${statCard({
          label: 'Focus',
          value: `${Math.round(focusMinutes / 60)}h ${focusMinutes % 60 ? `${focusMinutes % 60}m` : ''}`.trim(),
          iconName: 'timer',
          foot: `${pluralize(focusSessions.length, 'session')} logged`,
        })}
        ${statCard({
          label: 'Tasks done',
          value: String(doneThisWeek.length),
          iconName: 'tasks',
          foot: `${openTasks.length} still open`,
        })}
        ${statCard({
          label: 'Completion',
          value: `${completion}%`,
          unit: '',
          iconName: 'target',
          foot: `${totalDone} of ${state.tasks.length} tasks all-time`,
          tone: 'is-good',
        })}
      </div>

      <div class="stats-columns">
        <div class="card chart-card">
          <div class="card-head">
            <h2>Daily load</h2>
            <span class="card-sub">Scheduled hours per day</span>
          </div>
          <div class="bar-chart">
            ${dayTotals
              .map(
                (d) => `
              <div class="bar-col ${isToday(d.date) ? 'is-today' : ''}" title="${d.date.toLocaleDateString(undefined, { weekday: 'long' })}: ${durationLabel(d.minutes)}">
                <span class="bar-value">${d.minutes ? durationLabel(d.minutes) : ''}</span>
                <div class="bar-track"><span class="bar-fill" style="height:${Math.max(2, (d.minutes / maxDay) * 100)}%"></span></div>
                <span class="bar-label">${DAY_SHORT[d.date.getDay()]}</span>
              </div>`,
              )
              .join('')}
          </div>
        </div>

        <div class="card cat-card">
          <div class="card-head">
            <h2>Where time goes</h2>
            <a class="card-link" href="#settings" data-open-settings>Edit targets</a>
          </div>
          <div class="cat-breakdown">
            ${byCat
              .map(
                ({ cat, minutes, target }) => `
              <div class="cat-row">
                <div class="cat-row-head">
                  <span class="cat-name"><i class="dot" style="--cat:${store.catColor(cat.id)}"></i>${esc(cat.name)}</span>
                  <span class="cat-time">${durationLabel(minutes)}${target ? ` <em>/ ${durationLabel(target)}</em>` : ''}</span>
                </div>
                <div class="cat-track" title="${target ? `${pct(minutes, target)}% of weekly target` : 'No target set'}">
                  <span class="cat-fill" style="width:${target ? Math.min(100, pct(minutes, target)) : minutes ? 100 : 0}%;--cat:${store.catColor(cat.id)}"></span>
                </div>
              </div>`,
              )
              .join('')}
          </div>
        </div>
      </div>

      <div class="stats-columns">
        <div class="card insights-card">
          <div class="card-head">
            <h2>What stands out</h2>
            <span class="card-sub">Auto-generated from your plan</span>
          </div>
          <div class="insight-list">
            ${insights
              .map(
                (item) => `
              <div class="insight ${item.tone ? `is-${item.tone}` : ''}">
                <span class="insight-icon">${icon(item.icon)}</span>
                <p>${item.text}</p>
                ${item.action ? `<button type="button" class="btn btn-sm btn-ghost" data-goto="${item.action.view}">${esc(item.action.label)}</button>` : ''}
              </div>`,
              )
              .join('')}
          </div>
        </div>

        <div class="card habits-card">
          <div class="card-head">
            <h2>Focus & habits</h2>
            <span class="card-sub">Consistency beats intensity</span>
          </div>
          <div class="habit-hero">
            <div class="streak-ring" style="--p:${Math.min(100, streak * 10)}%">
              <div class="streak-inner"><strong>${streak}</strong><span>day streak</span></div>
            </div>
            <div class="habit-stats">
              <div class="habit-stat"><span>Focus this week</span><strong>${durationLabel(focusMinutes)}</strong></div>
              <div class="habit-stat"><span>Avg session</span><strong>${focusSessions.length ? durationLabel(Math.round(focusMinutes / focusSessions.length)) : '—'}</strong></div>
              <div class="habit-stat"><span>Blocks per day</span><strong>${(dates.reduce((n, d) => n + map[dateKey(d)].length, 0) / dates.length).toFixed(1)}</strong></div>
              <div class="habit-stat"><span>Overlapping pairs</span><strong>${conflictPairs}</strong></div>
            </div>
          </div>
          <div class="habit-targets">
            <h3>Weekly targets</h3>
            ${byCat
              .filter((c) => c.target > 0)
              .map(
                (c) => `
              <div class="target-row">
                <span>${esc(c.cat.name)}</span>
                <div class="target-track"><span style="width:${Math.min(100, pct(c.minutes, c.target))}%;--cat:${store.catColor(c.cat.id)}"></span></div>
                <em>${durationLabel(c.minutes)}</em>
              </div>`,
              )
              .join('') || '<p class="card-empty">No targets yet — set them in Settings.</p>'}
          </div>
        </div>
      </div>
    </section>`;

  root.innerHTML = html;
  mount(root);
}

function mount(root) {
  root.querySelector('[data-prev]')?.addEventListener('click', () => {
    const state = store.get();
    const start = parseKey(state.ui.weekStart) || startOfWeek(new Date(), state.settings.weekStart);
    store.setUi({ weekStart: dateKey(addDays(start, -7)) });
  });
  root.querySelector('[data-next]')?.addEventListener('click', () => {
    const state = store.get();
    const start = parseKey(state.ui.weekStart) || startOfWeek(new Date(), state.settings.weekStart);
    store.setUi({ weekStart: dateKey(addDays(start, 7)) });
  });
  root.querySelector('[data-today]')?.addEventListener('click', () => {
    const state = store.get();
    store.setUi({ weekStart: dateKey(startOfWeek(new Date(), state.settings.weekStart)) });
  });
  root.querySelectorAll('[data-goto]').forEach((btn) => {
    btn.addEventListener('click', () => store.setUi({ view: btn.dataset.goto }));
  });
  root.querySelector('[data-open-settings]')?.addEventListener('click', (e) => {
    e.preventDefault();
    store.setUi({ view: 'settings' });
  });
}
