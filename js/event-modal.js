/* Create / edit a timetable block. */

import * as store from './store.js';
import { openModal, toast, confirmDialog, icon } from './ui.js';
import {
  uid, dateKey, parseKey, timeLabel, timeInputValue, parseTimeValue, durationLabel,
  esc, snapMinutes, clamp, weekdayName, formatLongDate, DAY_SHORT,
} from './util.js';

const REMINDERS = [
  ['', 'No reminder'],
  ['0', 'At start time'],
  ['5', '5 minutes before'],
  ['10', '10 minutes before'],
  ['15', '15 minutes before'],
  ['30', '30 minutes before'],
  ['60', '1 hour before'],
];

export function openEventModal({ event = null, date = new Date(), start = null, end = null } = {}) {
  const state = store.get();
  const s = state.settings;
  const editing = !!event;
  const isRecurring = editing && event.repeat === 'weekly';
  const occurrenceDate = date instanceof Date ? date : parseKey(date) || new Date();
  const formDate = editing ? (isRecurring ? occurrenceDate : parseKey(event.date) || occurrenceDate) : occurrenceDate;

  const startMin = start != null ? start : editing ? event.start : s.dayStart + 120;
  const endMin = end != null ? end : editing ? event.end : Math.min(s.dayEnd, startMin + s.defaultDuration);
  const title = editing ? event.title : '';
  const catOptions = state.categories
    .map((c) => `<option value="${c.id}" ${editing && event.catId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`)
    .join('');
  const reminderValue = editing && event.reminder != null ? String(event.reminder) : (editing ? '' : '10');

  const body = `
    <form class="form" id="event-form" novalidate>
      <label class="field">
        <span class="field-label">Title</span>
        <input class="input input-lg" name="title" maxlength="120" placeholder="e.g. Linear Algebra"
          value="${esc(title)}" data-autofocus autocomplete="off">
      </label>
      <div class="form-grid">
        <label class="field">
          <span class="field-label">Category</span>
          <select class="select" name="catId">${catOptions}</select>
        </label>
        <label class="field">
          <span class="field-label">Repeats</span>
          <select class="select" name="repeat">
            <option value="weekly" ${!editing || event.repeat === 'weekly' ? 'selected' : ''}>Every week</option>
            <option value="once" ${editing && event.repeat === 'once' ? 'selected' : ''}>This date only</option>
          </select>
        </label>
      </div>
      <div class="form-grid">
        <label class="field">
          <span class="field-label">Date</span>
          <input class="input" type="date" name="date" value="${dateKey(formDate)}">
        </label>
        <div class="field">
          <span class="field-label">Time</span>
          <div class="time-row">
            <input class="input" type="time" name="start" step="300" value="${timeInputValue(startMin)}">
            <span class="time-dash">–</span>
            <input class="input" type="time" name="end" step="300" value="${timeInputValue(Math.min(endMin, 1439))}">
          </div>
        </div>
      </div>
      <div class="form-row-note" id="repeat-hint">${isRecurring ? `Repeats every ${weekdayName(event.weekday)}. Editing changes every week.` : 'A one-off block on this date.'}</div>
      <div class="form-grid">
        <label class="field">
          <span class="field-label">Location</span>
          <input class="input" name="location" maxlength="120" placeholder="Optional" value="${esc(editing ? event.location : '')}">
        </label>
        <label class="field">
          <span class="field-label">Reminder</span>
          <select class="select" name="reminder">
            ${REMINDERS.map(([v, label]) => `<option value="${v}" ${reminderValue === v ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </label>
      </div>
      <label class="field">
        <span class="field-label">Notes</span>
        <textarea class="textarea" name="notes" rows="3" placeholder="Anything to remember…">${esc(editing ? event.notes : '')}</textarea>
      </label>
      <p class="form-error" id="event-error" hidden></p>
      <div class="form-hint-row"><span class="duration-chip" id="duration-chip">${durationLabel(Math.max(0, endMin - startMin))}</span></div>
    </form>`;

  const left = editing
    ? `<button type="button" class="btn btn-ghost btn-danger-text" data-delete>${icon('trash')} Delete</button>
       ${isRecurring ? `<button type="button" class="btn btn-ghost" data-skip>Skip this week</button>` : ''}
       <button type="button" class="btn btn-ghost" data-duplicate>${icon('copy')} Duplicate</button>`
    : '';

  const footer = `
    <div class="modal-foot-row">
      <div class="modal-foot-left">${left}</div>
      <div class="modal-foot-right">
        <button type="button" class="btn" data-cancel>Cancel</button>
        <button type="submit" form="event-form" class="btn btn-primary">${editing ? 'Save changes' : 'Add event'}</button>
      </div>
    </div>`;

  const modal = openModal({
    title: editing ? 'Edit event' : 'New event',
    subtitle: editing ? (isRecurring ? 'Weekly event' : formatLongDate(formDate)) : formatLongDate(formDate),
    body,
    footer,
    size: 'md',
    className: 'modal-event',
  });

  const form = modal.el.querySelector('#event-form');
  const errorEl = modal.el.querySelector('#event-error');
  const repeatSelect = form.elements.repeat;
  const dateInput = form.elements.date;
  const startInput = form.elements.start;
  const endInput = form.elements.end;
  const hint = modal.el.querySelector('#repeat-hint');
  const durationChip = modal.el.querySelector('#duration-chip');

  function refreshDerived() {
    const weekly = repeatSelect.value === 'weekly';
    if (weekly) {
      const d = parseKey(dateInput.value) || new Date();
      hint.textContent = `Repeats every ${DAY_SHORT[d.getDay()]}${editing && event.repeat === 'weekly' ? '. Editing changes every week.' : '.'}`;
    } else {
      hint.textContent = 'A one-off block on this date.';
    }
    const st = parseTimeValue(startInput.value);
    let en = parseTimeValue(endInput.value);
    if (st != null) {
      const sMin = st;
      if (en != null) durationChip.textContent = durationLabel(Math.max(0, en - sMin));
    }
  }

  repeatSelect.addEventListener('change', refreshDerived);
  dateInput.addEventListener('change', refreshDerived);
  startInput.addEventListener('input', refreshDerived);
  endInput.addEventListener('input', refreshDerived);

  // Keep the end time sensible when the start moves.
  startInput.addEventListener('change', () => {
    const st = parseTimeValue(startInput.value);
    const en = parseTimeValue(endInput.value);
    if (st != null && en != null && en <= st) {
      endInput.value = timeInputValue(Math.min(1439, st + (s.defaultDuration || 60)));
      refreshDerived();
    }
  });

  const fail = (msg) => {
    errorEl.hidden = false;
    errorEl.textContent = msg;
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    const data = new FormData(form);
    const titleValue = String(data.get('title') || '').trim();
    if (!titleValue) {
      fail('Give the event a title.');
      form.elements.title.focus();
      return;
    }
    const startVal = parseTimeValue(data.get('start'));
    let endVal = parseTimeValue(data.get('end'));
    if (startVal == null || endVal == null) {
      fail('Set a start and end time.');
      return;
    }
    if (endVal === 0) endVal = 1440;
    if (endVal <= startVal) {
      fail('The end time must be after the start time.');
      return;
    }
    const dateVal = data.get('date');
    if (!dateVal) {
      fail('Pick a date.');
      return;
    }
    const repeat = data.get('repeat');
    const reminderRaw = data.get('reminder');
    const weekday = (parseKey(dateVal) || new Date()).getDay();

    const payload = {
      title: titleValue,
      catId: data.get('catId') || '',
      repeat,
      weekday,
      start: startVal,
      end: endVal,
      location: String(data.get('location') || '').trim(),
      notes: String(data.get('notes') || ''),
      reminder: reminderRaw === '' ? null : Number(reminderRaw),
    };

    if (editing) {
      store.mutate((st) => {
        const target = st.events.find((x) => x.id === event.id);
        if (!target) return;
        Object.assign(target, payload);
        if (repeat === 'weekly') {
          target.date = null;
          target.exdates = target.exdates || [];
        } else {
          target.date = dateVal;
        }
      });
      toast('Event updated', { type: 'success' });
    } else {
      store.mutate((st) => {
        st.events.push({
          id: uid('ev'),
          ...payload,
          date: repeat === 'once' ? dateVal : null,
          exdates: [],
        });
      });
      toast('Event added', { type: 'success' });
    }
    modal.close();
  });

  modal.el.querySelector('[data-cancel]').addEventListener('click', () => modal.close());

  const deleteBtn = modal.el.querySelector('[data-delete]');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: isRecurring ? 'Delete weekly event?' : 'Delete event?',
        message: isRecurring
          ? `“${esc(event.title)}” will be removed from every week.`
          : `“${esc(event.title)}” will be deleted.`,
        confirmText: 'Delete',
        danger: true,
      });
      if (!ok) return;
      store.mutate((st) => {
        st.events = st.events.filter((x) => x.id !== event.id);
      });
      toast('Event deleted', { type: 'success', action: { label: 'Undo', onClick: () => store.undo() } });
      modal.close();
    });
  }

  const skipBtn = modal.el.querySelector('[data-skip]');
  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      const key = dateKey(occurrenceDate);
      store.mutate((st) => {
        const target = st.events.find((x) => x.id === event.id);
        if (!target) return;
        target.exdates = Array.from(new Set([...(target.exdates || []), key]));
      });
      toast('Skipped this week', { type: 'success', action: { label: 'Undo', onClick: () => store.undo() } });
      modal.close();
    });
  }

  const duplicateBtn = modal.el.querySelector('[data-duplicate]');
  if (duplicateBtn) {
    duplicateBtn.addEventListener('click', () => {
      const copy = {
        ...JSON.parse(JSON.stringify(event)),
        id: uid('ev'),
        title: `${event.title} (copy)`,
        exdates: [],
      };
      store.mutate((st) => {
        st.events.push(copy);
      });
      modal.close();
      toast('Event duplicated', { type: 'success' });
      setTimeout(() => openEventModal({ event: copy, date: copy.repeat === 'weekly' ? occurrenceDate : parseKey(copy.date) }), 60);
    });
  }

  refreshDerived();
}
