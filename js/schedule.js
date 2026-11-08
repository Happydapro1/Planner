/* Time-blocking actions shared by the tasks view, tray and task editor. */

import * as store from './store.js';
import { uid, dateKey, timeLabel } from './util.js';
import { toast } from './ui.js';

export function scheduleTask(taskId, { silent = false } = {}) {
  const state = store.get();
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return null;
  const slot = store.findFreeSlot(state, task.estMins || 60);
  if (!slot) {
    toast('No free slot found in the next three weeks', { type: 'warn' });
    return null;
  }
  store.mutate((s) => {
    s.events.push({
      id: uid('ev'),
      title: task.title,
      catId: task.catId,
      repeat: 'once',
      date: dateKey(slot.date),
      weekday: slot.date.getDay(),
      start: slot.start,
      end: slot.end,
      exdates: [],
      reminder: 10,
      location: '',
      notes: task.notes || '',
      taskId: task.id,
    });
  });
  if (!silent) {
    const when = `${slot.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} at ${timeLabel(slot.start, state.settings.hour24)}`;
    toast(`Scheduled: ${when}`, {
      type: 'success',
      action: { label: 'Undo', onClick: () => store.undo() },
    });
  }
  return slot;
}

/** Remove the calendar block that belongs to a task. */
export function unscheduleTask(taskId) {
  store.mutate((s) => {
    s.events = s.events.filter((e) => e.taskId !== taskId);
  });
}
