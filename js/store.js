/* Central state: persistence, undo/redo, and derived timetable helpers. */

import {
  uid, dateKey, parseKey, addDays, startOfWeek, weekDates, timeLabel, startOfDay,
} from './util.js';

const STORAGE_KEY = 'tempo.planner.v1';
const HISTORY_LIMIT = 60;

export const COLORS = {
  indigo: '#6366f1',
  violet: '#8b5cf6',
  blue: '#3b82f6',
  teal: '#14b8a6',
  emerald: '#22c55e',
  amber: '#f59e0b',
  rose: '#f43f5e',
  slate: '#64748b',
};

export const COLOR_NAMES = Object.keys(COLORS);

export const DEFAULT_CATEGORIES = [
  { id: 'cat_class', name: 'Classes', color: 'indigo', target: 12 },
  { id: 'cat_study', name: 'Study', color: 'violet', target: 10 },
  { id: 'cat_work', name: 'Work', color: 'teal', target: 8 },
  { id: 'cat_fitness', name: 'Fitness', color: 'amber', target: 4 },
  { id: 'cat_personal', name: 'Personal', color: 'rose', target: 4 },
];

const BASE_SETTINGS = {
  name: '',
  weekStart: 1,
  dayStart: 6 * 60,
  dayEnd: 23 * 60,
  slot: 30,
  hour24: true,
  theme: 'dark',
  accent: 'indigo',
  showWeekends: true,
  defaultDuration: 60,
  notifications: false,
  workMins: 25,
  breakMins: 5,
  longBreakMins: 15,
};

function baseUi() {
  return {
    view: 'week',
    weekStart: dateKey(startOfWeek(new Date(), 1)),
    dayDate: dateKey(new Date()),
    hiddenCats: [],
    noteDate: dateKey(new Date()),
    taskFilter: 'todo',
    taskQuery: '',
    trayOpen: true,
  };
}

function ev(data) {
  return {
    id: uid('ev'),
    catId: 'cat_class',
    repeat: 'weekly',
    exdates: [],
    reminder: null,
    location: '',
    notes: '',
    ...data,
  };
}

function tk(data) {
  return {
    id: uid('task'),
    notes: '',
    priority: 1,
    due: '',
    catId: '',
    done: false,
    doneAt: '',
    estMins: 60,
    subtasks: [],
    ...data,
  };
}

function sampleData() {
  const today = startOfDay(new Date());
  const nextWed = addDays(today, ((3 - today.getDay() + 7) % 7) || 7);
  const nextFri = addDays(today, ((5 - today.getDay() + 7) % 7) || 7);

  const events = [
    ev({ title: 'Linear Algebra', weekday: 1, start: 540, end: 630, catId: 'cat_class', location: 'Hall B2', reminder: 10 }),
    ev({ title: 'Programming Lab', weekday: 1, start: 660, end: 750, catId: 'cat_class', location: 'Lab 4' }),
    ev({ title: 'Problem set deep work', weekday: 1, start: 900, end: 1020, catId: 'cat_study', reminder: 10 }),
    ev({ title: 'Statistics', weekday: 2, start: 600, end: 690, catId: 'cat_class', location: 'Hall A1' }),
    ev({ title: 'Project work', weekday: 2, start: 840, end: 960, catId: 'cat_work', notes: 'Sprint board + code review.' }),
    ev({ title: 'Gym — strength', weekday: 2, start: 1080, end: 1140, catId: 'cat_fitness', location: 'FitClub' }),
    ev({ title: 'Linear Algebra', weekday: 3, start: 540, end: 630, catId: 'cat_class', location: 'Hall B2' }),
    ev({ title: 'Lunch with team', weekday: 3, start: 780, end: 840, catId: 'cat_personal', location: 'Canteen' }),
    ev({ title: 'Library session', weekday: 3, start: 900, end: 1020, catId: 'cat_study', location: 'Library, 2nd floor' }),
    ev({ title: 'Statistics', weekday: 4, start: 600, end: 690, catId: 'cat_class', location: 'Hall A1' }),
    ev({ title: 'Project work', weekday: 4, start: 780, end: 900, catId: 'cat_work' }),
    ev({ title: 'Programming Lab', weekday: 5, start: 540, end: 600, catId: 'cat_class', location: 'Lab 4' }),
    ev({ title: 'Weekly review', weekday: 5, start: 660, end: 720, catId: 'cat_work', notes: 'Inbox zero, plan next week.' }),
    ev({ title: 'Gym — cardio', weekday: 5, start: 1080, end: 1140, catId: 'cat_fitness', location: 'FitClub' }),
    ev({ title: 'Long run', weekday: 6, start: 600, end: 660, catId: 'cat_fitness', location: 'Riverside park' }),
    ev({ title: 'Plan the week', weekday: 0, start: 1020, end: 1080, catId: 'cat_personal', reminder: 15 }),
    ev({
      title: 'Dentist appointment', repeat: 'once', date: dateKey(nextWed),
      weekday: nextWed.getDay(), start: 960, end: 1020, catId: 'cat_personal',
      location: 'Smile Clinic', reminder: 30,
    }),
    ev({
      title: 'Movie night', repeat: 'once', date: dateKey(nextFri),
      weekday: nextFri.getDay(), start: 1200, end: 1320, catId: 'cat_personal',
    }),
  ];

  const tasks = [
    tk({
      title: 'Finish problem set 4', catId: 'cat_study', priority: 2, estMins: 90,
      due: dateKey(addDays(today, 2)),
      notes: 'Focus on the eigendecomposition questions.',
      subtasks: [
        { id: uid('sub'), title: 'Question 1 (a–c)', done: true },
        { id: uid('sub'), title: 'Question 2', done: false },
        { id: uid('sub'), title: 'Check answers', done: false },
      ],
    }),
    tk({ title: 'Read chapter 6 — hypothesis testing', catId: 'cat_study', priority: 1, estMins: 45, due: dateKey(addDays(today, 1)) }),
    tk({ title: 'Draft project proposal', catId: 'cat_work', priority: 2, estMins: 120, due: dateKey(addDays(today, 4)), notes: 'Outline, timeline, risks.' }),
    tk({ title: 'Book dentist follow-up', catId: 'cat_personal', priority: 0, estMins: 15, due: dateKey(today) }),
    tk({ title: 'Grocery run', catId: 'cat_personal', priority: 0, estMins: 30, due: dateKey(addDays(today, 3)) }),
    tk({ title: 'Update study plan', catId: 'cat_study', priority: 1, estMins: 30, done: true, doneAt: dateKey(addDays(today, -1)) }),
    tk({ title: 'Submit expense report', catId: 'cat_work', priority: 1, estMins: 20, done: true, doneAt: dateKey(addDays(today, -2)) }),
  ];

  const notes = {};
  notes[dateKey(today)] = 'Week plan:\n\n- Finish problem set 4 before Thursday\n- Draft the proposal outline\n- Two gym sessions minimum\n- Read 30 pages every day\n\nIdea: block 15:00–17:00 for deep work, keep mornings for lectures.';

  const focusSessions = [
    { id: uid('focus'), date: dateKey(addDays(today, -1)), minutes: 50, taskId: '', catId: 'cat_study', at: Date.now() - 86400000 },
    { id: uid('focus'), date: dateKey(addDays(today, -2)), minutes: 25, taskId: '', catId: 'cat_work', at: Date.now() - 172800000 },
    { id: uid('focus'), date: dateKey(addDays(today, -2)), minutes: 25, taskId: '', catId: 'cat_work', at: Date.now() - 170000000 },
  ];

  return { events, tasks, notes, focusSessions };
}

function defaultState(withSample = true) {
  const base = {
    version: 1,
    settings: { ...BASE_SETTINGS },
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    events: [],
    tasks: [],
    notes: {},
    focusSessions: [],
    ui: baseUi(),
    createdAt: Date.now(),
  };
  if (!withSample) return base;
  return { ...base, ...sampleData() };
}

function pickData(state) {
  return {
    events: state.events,
    tasks: state.tasks,
    notes: state.notes,
    categories: state.categories,
    focusSessions: state.focusSessions,
  };
}

function load() {
  const fallback = defaultState(false);
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return fallback;
  }
  if (!raw) return fallback;
  try {
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== 'object') return fallback;
    return {
      ...defaultState(false),
      ...saved,
      settings: { ...BASE_SETTINGS, ...(saved.settings || {}) },
      ui: { ...baseUi(), ...(saved.ui || {}) },
      events: Array.isArray(saved.events) ? saved.events : [],
      tasks: Array.isArray(saved.tasks) ? saved.tasks : [],
      categories: Array.isArray(saved.categories) && saved.categories.length ? saved.categories : DEFAULT_CATEGORIES.map((c) => ({ ...c })),
      notes: saved.notes && typeof saved.notes === 'object' ? saved.notes : {},
      focusSessions: Array.isArray(saved.focusSessions) ? saved.focusSessions : [],
    };
  } catch {
    return fallback;
  }
}

let state = load();
const listeners = new Set();
const historyStack = [];
const redoStack = [];
let saveTimer = null;

function persistNow() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage may be full or blocked — the app keeps working in memory */
  }
}

function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, 120);
}

function emit() {
  for (const fn of listeners) {
    try {
      fn(state);
    } catch (err) {
      console.error('Listener failed', err);
    }
  }
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function get() {
  return state;
}

export function settings() {
  return state.settings;
}

export function ui() {
  return state.ui;
}

export function setUi(patch) {
  Object.assign(state.ui, patch);
  persist();
  emit();
}

export function mutate(fn, { history = true } = {}) {
  const before = history ? JSON.stringify(pickData(state)) : null;
  const result = fn(state);
  if (history) {
    historyStack.push(before);
    if (historyStack.length > HISTORY_LIMIT) historyStack.shift();
    redoStack.length = 0;
  }
  persist();
  emit();
  return result;
}

export function setNote(date, text, { silent = false } = {}) {
  state.notes[date] = text;
  if (!String(text).trim()) delete state.notes[date];
  persist();
  if (!silent) emit();
}

export function canUndo() {
  return historyStack.length > 0;
}

export function canRedo() {
  return redoStack.length > 0;
}

export function undo() {
  if (!historyStack.length) return false;
  redoStack.push(JSON.stringify(pickData(state)));
  Object.assign(state, JSON.parse(historyStack.pop()));
  persist();
  emit();
  return true;
}

export function redo() {
  if (!redoStack.length) return false;
  historyStack.push(JSON.stringify(pickData(state)));
  Object.assign(state, JSON.parse(redoStack.pop()));
  persist();
  emit();
  return true;
}

export function replaceAll(data) {
  const next = {
    ...defaultState(false),
    settings: { ...BASE_SETTINGS, ...(data.settings || {}) },
    ui: { ...baseUi(), ...(data.ui || {}) },
    events: Array.isArray(data.events) ? data.events : [],
    tasks: Array.isArray(data.tasks) ? data.tasks : [],
    categories: Array.isArray(data.categories) && data.categories.length ? data.categories : DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    notes: data.notes && typeof data.notes === 'object' ? data.notes : {},
    focusSessions: Array.isArray(data.focusSessions) ? data.focusSessions : [],
  };
  historyStack.length = 0;
  redoStack.length = 0;
  state = next;
  persistNow();
  emit();
}

export function resetAll(withSample = false) {
  historyStack.length = 0;
  redoStack.length = 0;
  state = defaultState(false);
  persistNow();
  emit();
}
export function resetAllSample() {
  historyStack.length = 0;
  redoStack.length = 0;
  state = defaultState(true);
  persistNow();
  emit();
}

export function exportPayload() {
  return JSON.stringify(
    {
      app: 'Tempo',
      version: 1,
      exportedAt: new Date().toISOString(),
      ...pickData(state),
      settings: state.settings,
      ui: state.ui,
    },
    null,
    2,
  );
}

export function categoryById(id) {
  return state.categories.find((c) => c.id === id) || null;
}

export function catColor(id) {
  const cat = categoryById(id);
  return (cat && COLORS[cat.color]) || COLORS.slate;
}

function makeInstance(event, date) {
  const key = dateKey(date);
  return {
    key: `${event.id}@${key}`,
    id: event.id,
    event,
    date,
    dateKey: key,
    start: event.start,
    end: event.end,
  };
}

export function instancesForDate(target, date) {
  const key = dateKey(date);
  const weekday = new Date(date).getDay();
  const out = [];
  for (const event of target.events) {
    if (event.repeat === 'weekly') {
      if (event.weekday !== weekday) continue;
      if ((event.exdates || []).includes(key)) continue;
      out.push(makeInstance(event, date));
    } else if (event.date === key) {
      out.push(makeInstance(event, date));
    }
  }
  return out.sort((a, b) => a.start - b.start || a.end - b.end);
}

export function displayedDates(target) {
  const s = target.settings;
  if (target.ui.view === 'day') {
    return [parseKey(target.ui.dayDate) || new Date()];
  }
  const start = parseKey(target.ui.weekStart) || startOfWeek(new Date(), s.weekStart);
  const count = s.showWeekends ? 7 : 5;
  return weekDates(start, count);
}

export function weekInstancesMap(target, dates) {
  const map = {};
  for (const d of dates) map[dateKey(d)] = instancesForDate(target, d);
  return map;
}

export function allInstancesForRange(target, days) {
  const start = startOfDay(new Date());
  const out = [];
  for (let i = 0; i < days; i += 1) {
    const d = addDays(start, i);
    out.push({ date: d, instances: instancesForDate(target, d) });
  }
  return out;
}

export function scheduledMinutes(instances) {
  return instances.reduce((sum, i) => sum + Math.max(0, i.end - i.start), 0);
}

export function unscheduledTasks(target) {
  const dates = displayedDates(target);
  const scheduled = new Set();
  for (const d of dates) {
    for (const inst of instancesForDate(target, d)) {
      if (inst.event.taskId) scheduled.add(inst.event.taskId);
    }
  }
  return target.tasks.filter((t) => !t.done && !scheduled.has(t.id));
}

export function todaySnapshot(target) {
  const today = new Date();
  const instances = instancesForDate(target, today);
  const minutes = scheduledMinutes(instances);
  const openTasks = target.tasks.filter((t) => !t.done).length;
  const dueToday = target.tasks.filter((t) => !t.done && t.due === dateKey(today)).length;
  const focusToday = target.focusSessions
    .filter((s) => s.date === dateKey(today))
    .reduce((sum, s) => sum + s.minutes, 0);
  return { instances, minutes, openTasks, dueToday, focusToday };
}

export function timeOfInstance(inst, hour24) {
  return `${timeLabel(inst.start, hour24)} – ${timeLabel(inst.end, hour24)}`;
}

/** Find the next free gap big enough for `duration` minutes. */
export function findFreeSlot(target, duration) {
  const s = target.settings;
  const days = s.showWeekends ? 21 : 15;
  const gap = 10;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  for (let i = 0; i < days; i += 1) {
    const date = addDays(now, i);
    if (!s.showWeekends && (date.getDay() === 0 || date.getDay() === 6)) continue;
    const instances = instancesForDate(target, date).sort((a, b) => a.start - b.start);
    let cursor = s.dayStart;
    if (i === 0) cursor = Math.max(cursor, Math.min(nowMin, s.dayEnd - duration));
    for (const inst of instances) {
      if (inst.start - cursor >= duration + gap) {
        return { date, start: cursor, end: cursor + duration };
      }
      cursor = Math.max(cursor, inst.end);
    }
    if (s.dayEnd - cursor >= duration) return { date, start: cursor, end: cursor + duration };
  }
  return null;
}

export function freeMinutesForDate(target, date) {
  const s = target.settings;
  const instances = instancesForDate(target, date);
  const busy = scheduledMinutes(instances);
  return Math.max(0, s.dayEnd - s.dayStart - busy);
}

persistNow();
window.addEventListener('storage', (e) => {
  if (e.key !== STORAGE_KEY) return;
  state = load();
  emit();
});
