/* Create / edit a task, with subtasks and quick due dates. */

import * as store from './store.js';
import { openModal, toast, confirmDialog, icon } from './ui.js';
import { uid, dateKey, addDays, parseKey, esc, formatShortDate, durationLabel } from './util.js';
import { scheduleTask, unscheduleTask } from './schedule.js';

const PRIORITIES = [
  { value: 0, label: 'Low' },
  { value: 1, label: 'Medium' },
  { value: 2, label: 'High' },
];

export function openTaskModal({ task = null } = {}) {
  const state = store.get();
  const editing = !!task;
  const initialPriority = editing ? Number(task.priority) || 0 : 1;
  let subtasks = editing ? JSON.parse(JSON.stringify(task.subtasks || [])) : [];

  const catOptions = [
    '<option value="">No category</option>',
    ...state.categories.map((c) => `<option value="${c.id}" ${editing && task.catId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`),
  ].join('');

  const body = `
    <form class="form" id="task-form" novalidate>
      <label class="field">
        <span class="field-label">Task</span>
        <input class="input input-lg" name="title" maxlength="160" placeholder="What needs doing?"
          value="${esc(editing ? task.title : '')}" data-autofocus autocomplete="off">
      </label>
      <div class="form-grid">
        <label class="field">
          <span class="field-label">Category</span>
          <select class="select" name="catId">${catOptions}</select>
        </label>
        <div class="field">
          <span class="field-label">Priority</span>
          <div class="segmented segmented-sm priority-seg" data-priority>
            ${PRIORITIES.map((p) => `<button type="button" class="prio-btn prio-${p.value} ${initialPriority === p.value ? 'is-active' : ''}" data-prio="${p.value}">${p.label}</button>`).join('')}
          </div>
          <input type="hidden" name="priority" value="${initialPriority}">
        </div>
      </div>
      <div class="form-grid">
        <label class="field">
          <span class="field-label">Due date</span>
          <input class="input" type="date" name="due" value="${editing && task.due ? task.due : ''}">
        </label>
        <label class="field">
          <span class="field-label">Estimate (minutes)</span>
          <input class="input" type="number" name="estMins" min="5" max="720" step="5"
            value="${editing ? task.estMins || 60 : 60}">
        </label>
      </div>
      <div class="quick-dates">
        <button type="button" class="chip" data-due-offset="0">Today</button>
        <button type="button" class="chip" data-due-offset="1">Tomorrow</button>
        <button type="button" class="chip" data-due-offset="3">In 3 days</button>
        <button type="button" class="chip" data-due-offset="7">Next week</button>
        <button type="button" class="chip" data-due-clear>No due date</button>
      </div>
      <div class="field">
        <span class="field-label">Subtasks</span>
        <div class="subtask-list" id="subtask-list"></div>
        <div class="subtask-add">
          <input class="input" id="subtask-input" placeholder="Add a step and press Enter" maxlength="120" autocomplete="off">
          <button type="button" class="icon-btn" id="subtask-add-btn" aria-label="Add subtask">${icon('plus')}</button>
        </div>
      </div>
      <label class="field">
        <span class="field-label">Notes</span>
        <textarea class="textarea" name="notes" rows="3" placeholder="Context, links, next steps…">${esc(editing ? task.notes : '')}</textarea>
      </label>
      <p class="form-error" id="task-error" hidden></p>
      ${editing ? `
      <div class="task-modal-meta">
        <span>${icon('clock')} ${durationLabel(task.estMins || 60)} estimated</span>
        ${task.due ? `<span>${icon('calendar')} Due ${formatShortDate(parseKey(task.due))}</span>` : ''}
      </div>` : ''}
    </form>`;

  const footer = `
    <div class="modal-foot-split">
      <div class="modal-foot-left">
        ${editing ? `<button type="button" class="btn btn-ghost btn-danger-text" data-delete>${icon('trash')} Delete</button>` : ''}
      </div>
      <div class="modal-foot-right">
        ${editing && !task.done ? `<button type="button" class="btn" data-schedule>${icon('calendar')} Schedule</button>` : ''}
        <button type="button" class="btn" data-cancel>Cancel</button>
        <button type="submit" form="task-form" class="btn btn-primary">${editing ? 'Save task' : 'Add task'}</button>
      </div>
    </div>`;

  const modal = openModal({
    title: editing ? 'Edit task' : 'New task',
    subtitle: editing && task.done ? 'Completed task' : 'Plan it, then time-block it',
    body,
    footer,
    size: 'md',
    className: 'modal-task',
  });

  const form = modal.el.querySelector('#task-form');
  const errorEl = modal.el.querySelector('#task-error');
  const listEl = modal.el.querySelector('#subtask-list');
  const dueInput = form.elements.due;
  const prioInput = form.elements.priority;

  function renderSubtasks() {
    if (!subtasks.length) {
      listEl.innerHTML = '<p class="subtask-empty">No steps yet — break the task down.</p>';
      return;
    }
    listEl.innerHTML = subtasks
      .map(
        (sub) => `
      <div class="subtask-row ${sub.done ? 'is-done' : ''}" data-sub="${sub.id}">
        <button type="button" class="subtask-check" data-sub-toggle aria-label="Toggle step">${sub.done ? icon('check') : ''}</button>
        <span class="subtask-title">${esc(sub.title)}</span>
        <button type="button" class="icon-btn icon-btn-sm" data-sub-remove aria-label="Remove step">${icon('x')}</button>
      </div>`,
      )
      .join('');
  }

  listEl.addEventListener('click', (e) => {
    const row = e.target.closest('[data-sub]');
    if (!row) return;
    const sub = subtasks.find((x) => x.id === row.dataset.sub);
    if (!sub) return;
    if (e.target.closest('[data-sub-toggle]')) {
      sub.done = !sub.done;
      renderSubtasks();
    } else if (e.target.closest('[data-sub-remove]')) {
      subtasks = subtasks.filter((x) => x.id !== sub.id);
      renderSubtasks();
    }
  });

  const addSubtask = () => {
    const input = modal.el.querySelector('#subtask-input');
    const value = input.value.trim();
    if (!value) return;
    subtasks.push({ id: uid('sub'), title: value, done: false });
    input.value = '';
    renderSubtasks();
    input.focus();
  };
  modal.el.querySelector('#subtask-add-btn').addEventListener('click', addSubtask);
  modal.el.querySelector('#subtask-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSubtask();
    }
  });

  modal.el.querySelectorAll('[data-prio]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const value = Number(btn.dataset.prio);
      prioInput.value = String(value);
      modal.el.querySelectorAll('[data-prio]').forEach((b) => b.classList.toggle('is-active', b === btn));
    });
  });

  modal.el.querySelectorAll('[data-due-offset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      dueInput.value = dateKey(addDays(new Date(), Number(btn.dataset.dueOffset)));
    });
  });
  modal.el.querySelector('[data-due-clear]').addEventListener('click', () => {
    dueInput.value = '';
  });

  function readForm() {
    const data = new FormData(form);
    const titleValue = String(data.get('title') || '').trim();
    if (!titleValue) {
      errorEl.hidden = false;
      errorEl.textContent = 'Give the task a title.';
      form.elements.title.focus();
      return null;
    }
    return {
      title: titleValue,
      catId: String(data.get('catId') || ''),
      priority: Number(data.get('priority')) || 0,
      due: String(data.get('due') || ''),
      estMins: Math.max(5, Number(data.get('estMins')) || 60),
      notes: String(data.get('notes') || ''),
      subtasks: subtasks.map((x) => ({ ...x })),
    };
  }

  function save() {
    const values = readForm();
    if (!values) return false;
    if (editing) {
      store.mutate((st) => {
        const target = st.tasks.find((x) => x.id === task.id);
        if (!target) return;
        Object.assign(target, values);
      });
      toast('Task updated', { type: 'success' });
    } else {
      store.mutate((st) => {
        st.tasks.push({
          id: uid('task'),
          ...values,
          done: false,
          doneAt: '',
        });
      });
      toast('Task added', { type: 'success' });
    }
    return true;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    if (save()) modal.close();
  });

  modal.el.querySelector('[data-cancel]').addEventListener('click', () => modal.close());

  const deleteBtn = modal.el.querySelector('[data-delete]');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Delete task?',
        message: `“${esc(task.title)}” and its subtasks will be removed. Any calendar block stays.`,
        confirmText: 'Delete',
        danger: true,
      });
      if (!ok) return;
      store.mutate((st) => {
        st.tasks = st.tasks.filter((x) => x.id !== task.id);
        st.events = st.events.filter((e) => e.taskId !== task.id);
      });
      toast('Task deleted', { type: 'success', action: { label: 'Undo', onClick: () => store.undo() } });
      modal.close();
    });
  }

  const scheduleBtn = modal.el.querySelector('[data-schedule]');
  if (scheduleBtn) {
    scheduleBtn.addEventListener('click', () => {
      errorEl.hidden = true;
      if (!save()) return;
      modal.close();
      scheduleTask(task.id);
    });
  }

  renderSubtasks();
}
