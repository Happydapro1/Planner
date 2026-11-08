/* Preferences, categories, notifications and data tools. */

import * as store from '../store.js';
import { icon, pageHead, toast, confirmDialog, beep } from '../ui.js';
import {
  dateKey, parseKey, timeInputValue, parseTimeValue, downloadFile, readFileText,
  esc, pad2, addDays, DAY_NAMES,
} from '../util.js';

const ACCENTS = ['indigo', 'violet', 'blue', 'teal', 'emerald', 'amber', 'rose'];

function icsEscape(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function icsStamp(date = new Date()) {
  return `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`;
}

function icsDateTime(date, minutes) {
  const d = new Date(date);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}T${pad2(h)}${pad2(m)}00`;
}

function buildIcs(state) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tempo//Timetable Planner//EN',
    'CALSCALE:GREGORIAN',
  ];
  const today = new Date();
  for (const ev of state.events) {
    let startDate;
    if (ev.repeat === 'weekly') {
      const delta = ((ev.weekday - today.getDay() + 7) % 7);
      startDate = addDays(today, delta);
    } else {
      startDate = parseKey(ev.date);
    }
    if (!startDate) continue;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.id}@tempo-planner`);
    lines.push(`DTSTAMP:${icsStamp()}`);
    lines.push(`DTSTART:${icsDateTime(startDate, ev.start)}`);
    lines.push(`DTEND:${icsDateTime(startDate, ev.end)}`);
    if (ev.repeat === 'weekly') {
      const codes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
      lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${codes[ev.weekday]}`);
    }
    lines.push(`SUMMARY:${icsEscape(ev.title)}`);
    if (ev.location) lines.push(`LOCATION:${icsEscape(ev.location)}`);
    if (ev.notes) lines.push(`DESCRIPTION:${icsEscape(ev.notes)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function toggleRow({ label, hint, setting, value }) {
  return `
    <div class="setting-row">
      <div class="setting-text"><strong>${esc(label)}</strong>${hint ? `<small>${esc(hint)}</small>` : ''}</div>
      <button type="button" class="switch ${value ? 'is-on' : ''}" role="switch" aria-checked="${value}" data-toggle="${setting}">
        <span class="switch-knob"></span>
      </button>
    </div>`;
}

export function renderSettings(root, state) {
  const s = state.settings;
  const storageBytes = (() => {
    try {
      return new Blob([localStorage.getItem('tempo.planner.v1') || '']).size;
    } catch {
      return 0;
    }
  })();

  const html = `
    <section class="page page-settings">
      ${pageHead({
        eyebrow: 'Preferences',
        title: 'Settings',
        subtitle: 'Everything is stored locally on this device',
        actions: '',
      })}

      <div class="settings-grid">
        <div class="card settings-card">
          <div class="card-head"><h2>${icon('settings')} General</h2></div>
          <label class="field">
            <span class="field-label">Your name</span>
            <input class="input" data-setting="name" value="${esc(s.name)}" placeholder="Used in your greeting" maxlength="40">
          </label>
          <div class="setting-row">
            <div class="setting-text"><strong>Week starts on</strong><small>First column of the planner</small></div>
            <select class="select select-sm" data-setting="weekStart" data-type="int">
              ${DAY_NAMES.map((d, i) => `<option value="${i}" ${s.weekStart === i ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
          </div>
          ${toggleRow({ label: '24-hour time', hint: '09:30 instead of 9:30 AM', setting: 'hour24', value: s.hour24 })}
          ${toggleRow({ label: 'Show weekends', hint: 'Hide Saturday and Sunday', setting: 'showWeekends', value: s.showWeekends })}
        </div>

        <div class="card settings-card">
          <div class="card-head"><h2>${icon('sun')} Appearance</h2></div>
          <div class="setting-row">
            <div class="setting-text"><strong>Theme</strong><small>Follow the system or pick one</small></div>
            <div class="segmented segmented-sm" data-theme-picker>
              ${['system', 'light', 'dark'].map((t) => `<button type="button" data-theme="${t}" class="${s.theme === t ? 'is-active' : ''}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}
            </div>
          </div>
          <div class="setting-row setting-row-col">
            <div class="setting-text"><strong>Accent</strong><small>Used for highlights and the timer</small></div>
            <div class="accent-row">
              ${ACCENTS.map((a) => `<button type="button" class="accent-swatch ${s.accent === a ? 'is-active' : ''}" data-accent="${a}" style="--swatch:${store.COLORS[a]}" aria-label="${a}">${s.accent === a ? icon('check') : ''}</button>`).join('')}
            </div>
          </div>
        </div>

        <div class="card settings-card">
          <div class="card-head"><h2>${icon('calendar')} Planner</h2></div>
          <div class="setting-row">
            <div class="setting-text"><strong>Visible hours</strong><small>The grid range</small></div>
            <div class="inline-inputs">
              <input class="input input-sm" type="time" step="900" data-setting="dayStart" data-type="time" value="${timeInputValue(s.dayStart)}">
              <span class="muted">to</span>
              <input class="input input-sm" type="time" step="900" data-setting="dayEnd" data-type="time" value="${timeInputValue(Math.min(s.dayEnd, 1439))}">
            </div>
          </div>
          <div class="setting-row">
            <div class="setting-text"><strong>Slot size</strong><small>Snap interval when dragging</small></div>
            <select class="select select-sm" data-setting="slot" data-type="int">
              ${[15, 20, 30, 60].map((m) => `<option value="${m}" ${Number(s.slot) === m ? 'selected' : ''}>${m} min</option>`).join('')}
            </select>
          </div>
          <div class="setting-row">
            <div class="setting-text"><strong>Default event length</strong><small>New blocks start with this</small></div>
            <select class="select select-sm" data-setting="defaultDuration" data-type="int">
              ${[15, 30, 45, 60, 90, 120].map((m) => `<option value="${m}" ${Number(s.defaultDuration) === m ? 'selected' : ''}>${m} min</option>`).join('')}
            </select>
          </div>
          <div class="setting-row">
            <div class="setting-text"><strong>Overlap layout</strong><small>Conflicting blocks sit side by side</small></div>
            <span class="badge-soft">Automatic</span>
          </div>
        </div>

        <div class="card settings-card">
          <div class="card-head"><h2>${icon('timer')} Focus timer</h2></div>
          <div class="setting-row">
            <div class="setting-text"><strong>Focus length</strong><small>Minutes per work block</small></div>
            <input class="input input-sm input-num" type="number" min="1" max="180" data-setting="workMins" data-type="int" value="${s.workMins}">
          </div>
          <div class="setting-row">
            <div class="setting-text"><strong>Short break</strong><small>Minutes</small></div>
            <input class="input input-sm input-num" type="number" min="1" max="60" data-setting="breakMins" data-type="int" value="${s.breakMins}">
          </div>
          <div class="setting-row">
            <div class="setting-text"><strong>Long break</strong><small>Minutes</small></div>
            <input class="input input-sm input-num" type="number" min="1" max="90" data-setting="longBreakMins" data-type="int" value="${s.longBreakMins}">
          </div>
          <div class="setting-row setting-row-col">
            <div class="setting-text"><strong>Notifications & sound</strong><small>Reminders and timer alerts</small></div>
            <div class="inline-actions">
              ${toggleRow({ label: 'Enable alerts', hint: '', setting: 'notifications', value: s.notifications })}
              <button type="button" class="btn btn-sm" data-permission>${icon('bell')} Browser permission</button>
              <button type="button" class="btn btn-sm" data-test-alert>Test</button>
            </div>
          </div>
        </div>

        <div class="card settings-card settings-card-wide">
          <div class="card-head">
            <h2>${icon('filter')} Categories</h2>
            <span class="card-sub">Colours and weekly hour targets</span>
          </div>
          <div class="category-table">
            ${state.categories
              .map(
                (cat) => `
              <div class="category-row" data-cat-row="${cat.id}">
                <span class="cat-dot" style="--cat:${store.COLORS[cat.color]}"></span>
                <input class="input input-sm" data-cat-name="${cat.id}" value="${esc(cat.name)}" maxlength="30" aria-label="Category name">
                <select class="select select-sm" data-cat-color="${cat.id}" aria-label="Category colour">
                  ${ACCENTS.concat('slate')
                    .map((c) => `<option value="${c}" ${cat.color === c ? 'selected' : ''}>${c[0].toUpperCase() + c.slice(1)}</option>`)
                    .join('')}
                </select>
                <label class="target-input">
                  <input class="input input-sm input-num" type="number" min="0" max="80" step="0.5" data-cat-target="${cat.id}" value="${cat.target || 0}">
                  <span>h / week</span>
                </label>
                <button type="button" class="icon-btn icon-btn-sm" data-cat-delete="${cat.id}" title="Delete category">${icon('trash')}</button>
              </div>`,
              )
              .join('')}
          </div>
          <div class="category-add">
            <input class="input input-sm" data-new-cat-name placeholder="New category name" maxlength="30">
            <select class="select select-sm" data-new-cat-color>
              ${ACCENTS.map((c) => `<option value="${c}">${c[0].toUpperCase() + c.slice(1)}</option>`).join('')}
            </select>
            <button type="button" class="btn btn-sm btn-primary" data-new-cat>${icon('plus')} Add</button>
          </div>
        </div>

        <div class="card settings-card">
          <div class="card-head"><h2>${icon('download')} Your data</h2></div>
          <p class="settings-note">No account, no cloud. Back up your planner as a JSON file, or move it to another device.</p>
          <div class="data-actions">
            <button type="button" class="btn btn-sm" data-export>${icon('download')} Export JSON</button>
            <button type="button" class="btn btn-sm" data-import>${icon('upload')} Import JSON</button>
            <button type="button" class="btn btn-sm" data-ics>${icon('calendar')} Export .ics</button>
            <button type="button" class="btn btn-sm" data-print-week>${icon('printer')} Print week</button>
            <input type="file" accept="application/json,.json" hidden data-import-input>
          </div>
          <div class="data-meta">${(storageBytes / 1024).toFixed(1)} KB stored locally · ${state.events.length} events · ${state.tasks.length} tasks</div>
        </div>

        <div class="card settings-card">
          <div class="card-head"><h2>${icon('alert')} Danger zone</h2></div>
          <p class="settings-note">Reset clears everything on this device. You can reload the sample data to explore first.</p>
          <div class="data-actions">
            <button type="button" class="btn btn-sm btn-ghost" data-sample>${icon('sparkles')} Load demo data</button>
            <button type="button" class="btn btn-sm btn-danger-outline" data-reset>${icon('trash')} Reset everything</button>
          </div>
        </div>

        <div class="card settings-card settings-card-wide">
          <div class="card-head"><h2>${icon('command')} Keyboard shortcuts</h2></div>
          <div class="shortcut-grid">
            <div><kbd>⌘</kbd><kbd>K</kbd><span>Command palette</span></div>
            <div><kbd>N</kbd><span>New event</span></div>
            <div><kbd>⇧</kbd><kbd>N</kbd><span>New task</span></div>
            <div><kbd>T</kbd><span>Jump to today</span></div>
            <div><kbd>←</kbd><kbd>→</kbd><span>Previous / next week</span></div>
            <div><kbd>⌘</kbd><kbd>Z</kbd><span>Undo</span></div>
            <div><kbd>⇧</kbd><kbd>⌘</kbd><kbd>Z</kbd><span>Redo</span></div>
            <div><kbd>?</kbd><span>Shortcut help</span></div>
          </div>
        </div>
      </div>
    </section>`;

  root.innerHTML = html;
  mount(root);
}

function applySetting(key, value) {
  store.mutate((st) => {
    if (key === 'dayEnd' && value <= st.settings.dayStart + 30) {
      value = st.settings.dayStart + 60;
    }
    if (key === 'dayStart' && value >= st.settings.dayEnd - 30) {
      value = st.settings.dayEnd - 60;
    }
    st.settings[key] = value;
  }, { history: false });
}

function mount(root) {
  root.querySelectorAll('[data-setting]').forEach((el) => {
    const commit = () => {
      const key = el.dataset.setting;
      const type = el.dataset.type;
      let value = el.value;
      if (type === 'int' || type === 'number') value = Number(value);
      if (type === 'time') value = parseTimeValue(value);
      if (value == null || (typeof value === 'number' && Number.isNaN(value))) return;
      applySetting(key, value);
    };
    if (el.tagName === 'INPUT' && el.type === 'text') {
      el.addEventListener('change', commit);
      el.addEventListener('blur', commit);
    } else {
      el.addEventListener('change', commit);
    }
  });

  root.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.toggle;
      const next = !store.get().settings[key];
      if (key === 'notifications' && next && window.Notification && Notification.permission !== 'granted') {
        try {
          await Notification.requestPermission();
        } catch {
          /* ignore */
        }
      }
      applySetting(key, next);
    });
  });

  root.querySelectorAll('[data-theme]').forEach((btn) => {
    btn.addEventListener('click', () => applySetting('theme', btn.dataset.theme));
  });
  root.querySelectorAll('[data-accent]').forEach((btn) => {
    btn.addEventListener('click', () => applySetting('accent', btn.dataset.accent));
  });

  root.querySelector('[data-permission]')?.addEventListener('click', async () => {
    if (!window.Notification) {
      toast('This browser does not expose notifications', { type: 'warn' });
      return;
    }
    try {
      const result = await Notification.requestPermission();
      if (result === 'granted') {
        applySetting('notifications', true);
        toast('Notifications enabled', { type: 'success' });
      } else {
        toast('Permission was not granted', { type: 'warn' });
      }
    } catch {
      toast('Could not request permission', { type: 'warn' });
    }
  });
  root.querySelector('[data-test-alert]')?.addEventListener('click', () => {
    beep(780, 0.16);
    toast('This is how reminders look', { type: 'info' });
    try {
      if (window.Notification && Notification.permission === 'granted') {
        new Notification('Tempo', { body: 'This is a test reminder.' });
      }
    } catch {
      /* ignore */
    }
  });

  // Category editing
  root.querySelectorAll('[data-cat-name]').forEach((input) => {
    input.addEventListener('change', () => {
      const id = input.dataset.catName;
      const name = input.value.trim();
      if (!name) {
        input.value = store.categoryById(id)?.name || '';
        return;
      }
      store.mutate((st) => {
        const cat = st.categories.find((c) => c.id === id);
        if (cat) cat.name = name;
      });
    });
  });
  root.querySelectorAll('[data-cat-color]').forEach((select) => {
    select.addEventListener('change', () => {
      const id = select.dataset.catColor;
      store.mutate((st) => {
        const cat = st.categories.find((c) => c.id === id);
        if (cat) cat.color = select.value;
      });
    });
  });
  root.querySelectorAll('[data-cat-target]').forEach((input) => {
    input.addEventListener('change', () => {
      const id = input.dataset.catTarget;
      const value = Math.max(0, Number(input.value) || 0);
      store.mutate((st) => {
        const cat = st.categories.find((c) => c.id === id);
        if (cat) cat.target = value;
      });
    });
  });
  root.querySelectorAll('[data-cat-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.catDelete;
      const cat = store.categoryById(id);
      if (!cat) return;
      if (store.get().categories.length <= 1) {
        toast('Keep at least one category', { type: 'warn' });
        return;
      }
      const affected = store.get().events.filter((e) => e.catId === id).length;
      const ok = await confirmDialog({
        title: `Delete “${esc(cat.name)}”?`,
        message: `${affected ? `${affected} calendar blocks will become uncategorised. ` : ''}This cannot be undone unless you undo immediately.`,
        confirmText: 'Delete category',
        danger: true,
      });
      if (!ok) return;
      store.mutate((st) => {
        st.categories = st.categories.filter((c) => c.id !== id);
        st.events.forEach((e) => {
          if (e.catId === id) e.catId = '';
        });
        st.tasks.forEach((t) => {
          if (t.catId === id) t.catId = '';
        });
      });
      toast('Category deleted', { type: 'success', action: { label: 'Undo', onClick: () => store.undo() } });
    });
  });
  root.querySelector('[data-new-cat]')?.addEventListener('click', () => {
    const nameInput = root.querySelector('[data-new-cat-name]');
    const colorSelect = root.querySelector('[data-new-cat-color]');
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      return;
    }
    store.mutate((st) => {
      st.categories.push({
        id: `cat_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
        name,
        color: colorSelect.value,
        target: 0,
      });
    });
    toast('Category added', { type: 'success' });
  });

  // Data tools
  root.querySelector('[data-export]')?.addEventListener('click', () => {
    downloadFile(`tempo-backup-${dateKey(new Date())}.json`, store.exportPayload(), 'application/json');
    toast('Backup downloaded', { type: 'success' });
  });

  const importInput = root.querySelector('[data-import-input]');
  root.querySelector('[data-import]')?.addEventListener('click', () => importInput?.click());
  importInput?.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    try {
      const text = await readFileText(file);
      const data = JSON.parse(text);
      if (!Array.isArray(data.events) && !Array.isArray(data.tasks)) {
        toast('That file does not look like a Tempo backup', { type: 'warn' });
        return;
      }
      const ok = await confirmDialog({
        title: 'Replace current planner?',
        message: 'Importing replaces your current events, tasks, notes and categories with the file contents.',
        confirmText: 'Import',
        danger: true,
      });
      if (!ok) return;
      store.replaceAll(data);
      toast('Planner imported', { type: 'success' });
    } catch {
      toast('Could not read that file', { type: 'warn' });
    } finally {
      importInput.value = '';
    }
  });

  root.querySelector('[data-ics]')?.addEventListener('click', () => {
    const state = store.get();
    if (!state.events.length) {
      toast('No events to export yet', { type: 'warn' });
      return;
    }
    downloadFile('tempo-calendar.ics', buildIcs(state), 'text/calendar');
    toast('Calendar file downloaded', { type: 'success' });
  });

  root.querySelector('[data-print-week]')?.addEventListener('click', () => {
    store.setUi({ view: 'week' });
    setTimeout(() => window.print(), 250);
  });

  root.querySelector('[data-sample]')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Load demo data?',
      message: 'Your current planner will be replaced with the demo timetable, tasks and notes.',
      confirmText: 'Load demo',
      danger: true,
    });
    if (!ok) return;
    store.resetAllSample();
    toast('Demo data loaded', { type: 'success' });
  });

  root.querySelector('[data-reset]')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Reset everything?',
      message: 'All events, tasks, notes, categories and focus sessions on this device will be erased.',
      confirmText: 'Erase everything',
      danger: true,
    });
    if (!ok) return;
    store.resetAll(false);
    toast('Planner reset', { type: 'success' });
  });
}
