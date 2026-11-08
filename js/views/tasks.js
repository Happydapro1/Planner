/* Task inbox with filters, grouping and time-blocking actions. */

import * as store from '../store.js';
import { icon, pageHead, toast, confirmDialog } from '../ui.js';
import { openTaskModal } from '../task-modal.js';
import { scheduleTask, unscheduleTask } from '../schedule.js';
import {
  dateKey, parseKey, diffDays, esc, durationLabel, formatShortDate, pluralize, pct,
} from '../util.js';

let search = '';

const FILTERS = [
  ['todo', 'To Do'],
  ['done', 'Done'],
];

const GROUPS = [
  ['overdue', 'Overdue'],
  ['today', 'Today'],
  ['tomorrow', 'Tomorrow'],
  ['week', 'This week'],
  ['later', 'Later'],
  ['someday', 'No due date'],
  ['done', 'Completed'],
];

function bucketFor(task) {
  if (task.done) return 'done';
  if (!task.due) return 'someday';
  const diff = diffDays(new Date(), parseKey(task.due));
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff <= 7) return 'week';
  return 'later';
}

function matchesFilter(task, filter) {
  if (filter === 'done') return !!task.done;
  // To Do always keeps overdue work visible instead of hiding it.
  return !task.done;
}

function dueChip(task) {
  if (!task.due) return '<span class="meta-chip">No due date</span>';
  const diff = diffDays(new Date(), parseKey(task.due));
  let cls = '';
  let label = formatShortDate(parseKey(task.due));
  if (!task.done) {
    if (diff < 0) { cls = 'is-overdue'; label = `${label} · ${Math.abs(diff)}d late`; }
    else if (diff === 0) { cls = 'is-today'; label = 'Today'; }
    else if (diff === 1) cls = 'is-soon';
  }
  return `<span class="meta-chip ${cls}">${icon('calendar')}${esc(label)}</span>`;
}

const PRIO_LABEL = ['Low', 'Medium', 'High'];

function taskMarkup(task, state, scheduledIds) {
  const cat = store.categoryById(task.catId);
  const total = (task.subtasks || []).length;
  const doneSubs = (task.subtasks || []).filter((s) => s.done).length;
  const scheduled = scheduledIds.has(task.id);
  const progress = total ? pct(doneSubs, total) : 0;
  return `
    <div class="task-row ${task.done ? 'is-done' : ''}" data-task-id="${task.id}"
      data-search="${esc(`${task.title} ${task.notes || ''} ${cat ? cat.name : ''}`.toLowerCase())}">
      <button type="button" class="task-check ${task.done ? 'is-checked' : ''}" data-toggle
        aria-label="${task.done ? 'Mark as not done' : 'Mark as done'}">${task.done ? icon('check') : ''}</button>
      <div class="task-main" data-edit role="button" tabindex="0">
        <div class="task-title">${esc(task.title)}</div>
        <div class="task-meta">
          ${cat ? `<span class="meta-chip" style="--cat:${store.catColor(cat.id)}"><i class="dot"></i>${esc(cat.name)}</span>` : ''}
          ${task.done ? '' : dueChip(task)}
          <span class="meta-chip prio-chip prio-${task.priority}">${icon('flag')}${PRIO_LABEL[task.priority] || 'Low'}</span>
          <span class="meta-chip">${icon('clock')}${durationLabel(task.estMins || 60)}</span>
          ${total ? `<span class="meta-chip">${icon('tasks')}${doneSubs}/${total}</span>` : ''}
          ${scheduled ? `<span class="meta-chip is-linked">${icon('calendar')}On calendar</span>` : ''}
        </div>
        ${total ? `<div class="task-progress" title="${progress}% of steps done"><span style="width:${progress}%"></span></div>` : ''}
      </div>
      <div class="task-actions">
        ${task.done ? '' : `<button type="button" class="icon-btn icon-btn-sm" data-sched
          title="${scheduled ? 'Remove from calendar' : 'Auto-schedule into a free slot'}">${icon(scheduled ? 'calendar' : 'sparkles')}</button>`}
        <button type="button" class="icon-btn icon-btn-sm" data-edit-btn title="Edit task">${icon('edit')}</button>
        <button type="button" class="icon-btn icon-btn-sm" data-del title="Delete task">${icon('trash')}</button>
      </div>
    </div>`;
}

export function renderTasks(root, state) {
  const today = dateKey(new Date());
  const tasks = state.tasks;
  const open = tasks.filter((t) => !t.done);
  const overdue = open.filter((t) => t.due && t.due < today);
  const dueToday = open.filter((t) => t.due === today);
  const doneToday = tasks.filter((t) => t.done && t.doneAt === today);
  const doneCount = tasks.filter((t) => t.done).length;
  const filter = state.ui.taskFilter === 'done' ? 'done' : 'todo';
  const scheduledIds = new Set(state.events.filter((e) => e.taskId).map((e) => e.taskId));
  const filtered = tasks.filter((t) => matchesFilter(t, filter));
  const groupsHtml = GROUPS.map(([bucket, label]) => {
    const items = filtered.filter((t) => bucketFor(t) === bucket);
    if (!items.length) return '';
    items.sort((a, b) => {
      if (bucket === 'done') return String(b.doneAt).localeCompare(String(a.doneAt));
      if (a.due !== b.due) return String(a.due || '9999').localeCompare(String(b.due || '9999'));
      return b.priority - a.priority;
    });
    return `
      <section class="task-group" data-group="${bucket}">
        <div class="task-group-head">
          <h2>${label}</h2>
          <span class="task-group-count">${items.length}</span>
        </div>
        <div class="task-list">${items.map((t) => taskMarkup(t, state, scheduledIds)).join('')}</div>
      </section>`;
  }).join('');

  const emptyCopy =
    filter === 'done' ? 'Nothing completed yet. Finish something small to get going.'
      : 'No tasks here. Add one to get started.';

  const html = `
    <section class="page page-tasks">
      ${pageHead({
        eyebrow: 'Task inbox',
        title: 'Tasks',
        subtitle: `${pluralize(open.length, 'open task')} · ${dueToday.length} due today · ${doneCount} done`,
        actions: `<button type="button" class="btn btn-primary" data-new>${icon('plus')} New task</button>`,
      })}

      <div class="task-toolbar card">
        <div class="task-toolbar-main">
          <div class="segmented segmented-sm task-filters">
            ${FILTERS.map(([value, label]) => `
              <button type="button" data-filter="${value}" class="${filter === value ? 'is-active' : ''}">
                ${label}
              </button>`).join('')}
          </div>
          <div class="task-search">
            <div class="task-search-field">
              ${icon('search')}
              <input
                class="input input-sm"
                type="search"
                placeholder="Search tasks…"
                value="${esc(search)}"
                data-search-input
              >
            </div>
            <button
              type="button"
              class="icon-btn icon-btn-sm task-search-clear ${search ? '' : 'is-hidden'}"
              data-clear-search
              title="Clear search"
              aria-label="Clear search"
            >${icon('x')}</button>
          </div>
        </div>
        ${filter === 'done' ? `<div class="task-toolbar-side">
          <button type="button" class="btn btn-sm btn-danger" data-clear-done title="Delete every completed task">
            ${icon('trash')} Delete All
          </button>
        </div>` : ''}
      </div>

      <div class="task-summary">
        <span>${icon('target')} ${pluralize(doneToday.length, 'task')} completed today</span>
        <span>${icon('alert')} ${pluralize(overdue.length, 'task')} overdue</span>
        <span>${icon('inbox')} ${pluralize(store.unscheduledTasks(state).filter((t) => !t.done).length, 'task')} to time-block</span>
      </div>
      <div class="task-groups">${groupsHtml || `<div class="empty-state card">${icon('tasks')}<p>${emptyCopy}</p></div>`}</div>
    </section>`;

  root.innerHTML = html;
  mount(root);
  applySearch(root);
}

function applySearch(root) {
  const q = search.trim().toLowerCase();
  const rows = root.querySelectorAll('.task-row');
  rows.forEach((row) => {
    row.hidden = !!q && !row.dataset.search.includes(q);
  });
  root.querySelectorAll('.task-group').forEach((group) => {
    const visible = group.querySelectorAll('.task-row:not([hidden])').length;
    group.hidden = visible === 0;
  });
}

function mount(root) {
  root.querySelector('[data-new]')?.addEventListener('click', () => openTaskModal({}));
  root.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      search = '';
      store.setUi({ taskFilter: btn.dataset.filter, taskQuery: '' });
    });
  });
  const searchInput = root.querySelector('[data-search-input]');
  const clearSearchBtn = root.querySelector('[data-clear-search]');
  const syncClear = () => clearSearchBtn?.classList.toggle('is-hidden', !search);

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      search = searchInput.value;
      applySearch(root);
      syncClear();
    });
    if (search) {
      searchInput.focus();
      searchInput.setSelectionRange(search.length, search.length);
    }
    syncClear();
  }

  clearSearchBtn?.addEventListener('click', () => {
    if (!searchInput) return;
    searchInput.value = '';
    search = '';
    applySearch(root);
    syncClear();
    searchInput.focus();
  });

  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      searchInput.value = '';
      search = '';
      applySearch(root);
      syncClear();
    }
  });

  root.querySelector('[data-clear-done]')?.addEventListener('click', async () => {
    const doneTasks = store.get().tasks.filter((t) => t.done);
    if (!doneTasks.length) {
      toast('No completed tasks to delete', { type: 'info' });
      return;
    }
    const ok = await confirmDialog({
      title: 'Delete all completed tasks?',
      message: `${pluralize(doneTasks.length, 'completed task')} will be removed, along with any calendar block they own.`,
      confirmText: 'Delete All',
      danger: true,
    });
    if (!ok) return;
    const ids = new Set(doneTasks.map((t) => t.id));
    store.mutate((st) => {
      st.tasks = st.tasks.filter((t) => !ids.has(t.id));
      st.events = st.events.filter((e) => !ids.has(e.taskId));
    });
    toast(`${pluralize(doneTasks.length, 'task')} deleted`, {
      type: 'success',
      action: { label: 'Undo', onClick: () => store.undo() },
    });
  });

  root.querySelectorAll('.task-row').forEach((row) => {
    const id = row.dataset.taskId;
    const task = store.get().tasks.find((t) => t.id === id);
    if (!task) return;

    row.querySelector('[data-toggle]')?.addEventListener('click', () => {
      store.mutate((st) => {
        const target = st.tasks.find((t) => t.id === id);
        if (!target) return;
        target.done = !target.done;
        target.doneAt = target.done ? dateKey(new Date()) : '';
        if (target.done) target.subtasks = (target.subtasks || []).map((s) => ({ ...s, done: true }));
      });
      toast(task.done ? 'Marked as open' : 'Task completed', {
        type: task.done ? 'info' : 'success',
        action: { label: 'Undo', onClick: () => store.undo() },
      });
    });

    row.querySelectorAll('[data-edit], [data-edit-btn]').forEach((el) => {
      el.addEventListener('click', () => openTaskModal({ task }));
    });

    row.querySelector('[data-sched]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const scheduled = store.get().events.find((ev) => ev.taskId === id);
      if (scheduled) {
        unscheduleTask(id);
        toast('Removed from calendar', { type: 'success', action: { label: 'Undo', onClick: () => store.undo() } });
      } else {
        scheduleTask(id);
      }
    });

    row.querySelector('[data-del]')?.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Delete task?',
        message: `“${esc(task.title)}” will be removed, along with any calendar block it owns.`,
        confirmText: 'Delete',
        danger: true,
      });
      if (!ok) return;
      store.mutate((st) => {
        st.tasks = st.tasks.filter((t) => t.id !== id);
        st.events = st.events.filter((e) => e.taskId !== id);
      });
      toast('Task deleted', { type: 'success', action: { label: 'Undo', onClick: () => store.undo() } });
    });
  });
}
