/* Small, dependency-free helpers shared by every view. */

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Local `YYYY-MM-DD` key for a Date (or date-like value). */
export function dateKey(input) {
  const d = input instanceof Date ? input : new Date(input);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Parse a `YYYY-MM-DD` key into a local midnight Date. */
export function parseKey(key) {
  if (!key) return null;
  const [y, m, d] = String(key).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function addDays(input, n) {
  const d = new Date(input);
  d.setDate(d.getDate() + n);
  return d;
}

export function startOfDay(input) {
  const d = new Date(input);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfWeek(input, weekStartsOn = 1) {
  const d = startOfDay(input);
  const diff = (d.getDay() - weekStartsOn + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

export function weekDates(start, count = 7) {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

export function isToday(d) {
  return dateKey(d) === dateKey(new Date());
}

export function isSameDay(a, b) {
  return dateKey(a) === dateKey(b);
}

export function diffDays(a, b) {
  return Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
}

export function minutesNow() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/** 570 -> "9:30 AM" (or "09:30" with hour24). */
export function timeLabel(min, hour24 = true) {
  if (min === 1440) return hour24 ? '24:00' : '12:00 AM';
  const m = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (hour24) return `${pad2(h)}:${pad2(mm)}`;
  const half = h < 12 ? 'AM' : 'PM';
  let hh = h % 12;
  if (hh === 0) hh = 12;
  return `${hh}:${pad2(mm)} ${half}`;
}

/** 570 -> "09:30" for <input type="time">. */
export function timeInputValue(min) {
  const m = Math.max(0, Math.min(1439, min));
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

export function parseTimeValue(value) {
  if (!value) return null;
  const [h, m] = String(value).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

export function durationLabel(min) {
  if (min == null || Number.isNaN(min)) return '';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function snapMinutes(min, step = 30) {
  return Math.round(min / step) * step;
}

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function pluralize(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural || `${singular}s`}`;
}

export function debounce(fn, wait = 300) {
  let timer = null;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  wrapped.flush = (...args) => {
    clearTimeout(timer);
    fn(...args);
  };
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}

export function formatLongDate(date) {
  return new Date(date).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

export function formatShortDate(date) {
  const d = new Date(date);
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}

export function formatRange(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const mo = (d) => MONTH_SHORT[d.getMonth()];
  if (s.getFullYear() !== e.getFullYear()) {
    return `${mo(s)} ${s.getDate()}, ${s.getFullYear()} – ${mo(e)} ${e.getDate()}, ${e.getFullYear()}`;
  }
  if (s.getMonth() === e.getMonth()) {
    return `${mo(s)} ${s.getDate()} – ${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${mo(s)} ${s.getDate()} – ${mo(e)} ${e.getDate()}, ${e.getFullYear()}`;
}

export function weekdayName(dayIndex) {
  return DAY_NAMES[((dayIndex % 7) + 7) % 7];
}

export function downloadFile(filename, text, mime = 'application/json') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'T';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

/** Rounded percentage that never divides by zero. */
export function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}
