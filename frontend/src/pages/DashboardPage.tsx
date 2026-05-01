import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LoaderCircle, PenLine, RefreshCw, Trash2, X, Send } from 'lucide-react';

type TaskStatus = 'pending' | 'in_progress' | 'done';
type TaskPriority = 'high' | 'medium' | 'low';

type DashboardTask = {
  id: string;
  meeting_id?: string;
  task: string;
  assignee: string;
  due_date_str: string;
  priority: TaskPriority;
  status: TaskStatus;
  context_notes: string;
  source?: string;
  created_at?: string | null;
  updated_at?: string | null;
};

type MeetingItem = {
  id: string;
  title: string;
  summary: string;
  topics: string[];
  decisions: string[];
  created_at?: string | null;
};

type DashboardData = {
  stats: {
    priority: number;
    pending: number;
    in_progress: number;
    completed: number;
    overdue: number;
    total: number;
  };
  highlights: string[];
  priority_tasks: DashboardTask[];
  tasks: DashboardTask[];
  meetings: MeetingItem[];
};

type ToastTone = 'success' | 'error' | 'info';

type ToastItem = {
  id: number;
  title: string;
  message: string;
  tone: ToastTone;
};

type EditDraft = {
  task: string;
  assignee: string;
  due_date_str: string;
  priority: TaskPriority;
  status: TaskStatus;
  context_notes: string;
};

const emptyDashboardData: DashboardData = {
  stats: {
    priority: 0,
    pending: 0,
    in_progress: 0,
    completed: 0,
    overdue: 0,
    total: 0,
  },
  highlights: [],
  priority_tasks: [],
  tasks: [],
  meetings: [],
};

const defaultEditDraft: EditDraft = {
  task: '',
  assignee: '',
  due_date_str: '',
  priority: 'medium',
  status: 'pending',
  context_notes: '',
};

const toastToneClass: Record<ToastTone, string> = {
  success: 'border-emerald-300/35 bg-emerald-500/15 text-emerald-100',
  error: 'border-rose-300/35 bg-rose-500/15 text-rose-100',
  info: 'border-sky-300/35 bg-sky-500/15 text-sky-100',
};

function statusLabel(status: TaskStatus) {
  if (status === 'in_progress') return 'In Progress';
  if (status === 'done') return 'Completed';
  return 'Pending';
}

function priorityLabel(priority: TaskPriority) {
  if (priority === 'high') return 'High Priority';
  if (priority === 'low') return 'Low Priority';
  return 'Medium Priority';
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData>(emptyDashboardData);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');

  const [taskMutationLoading, setTaskMutationLoading] = useState(false);
  const [meetingMutationLoading, setMeetingMutationLoading] = useState(false);
  const [editingTask, setEditingTask] = useState<DashboardTask | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>(defaultEditDraft);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = useCallback((title: string, message: string, tone: ToastTone) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, title, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const refreshDashboard = useCallback(async (silent = false) => {
    if (!silent) {
      setDashboardLoading(true);
    }
    setDashboardError('');

    try {
      const response = await fetch('/api/dashboard/context', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || `Failed to load dashboard (${response.status})`);
      }

      setDashboardData(payload.data || emptyDashboardData);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load dashboard data.';
      setDashboardError(message);
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshDashboard(true);
    }, 15000);

    return () => window.clearInterval(timer);
  }, [refreshDashboard]);

  const counters = useMemo(() => ({
    priority: dashboardData.stats.priority,
    pending: dashboardData.stats.pending,
    inProgress: dashboardData.stats.in_progress,
    completed: dashboardData.stats.completed,
    total: dashboardData.stats.total,
  }), [dashboardData.stats]);

  const applyTaskPayload = useCallback((payload: { task?: DashboardTask; stats?: DashboardData['stats'] }) => {
    if (!payload.task) {
      return;
    }

    setDashboardData((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.id === payload.task!.id ? payload.task! : task)),
      stats: payload.stats || current.stats,
    }));
  }, []);

  const updateTask = useCallback(
    async (taskId: string, patch: Partial<DashboardTask>, message = 'Task updated') => {
      setTaskMutationLoading(true);
      try {
        const response = await fetch(`/api/dashboard/task/${taskId}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(patch),
        });
        const payload = await response.json();
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || `Update failed (${response.status})`);
        }

        applyTaskPayload(payload as { task?: DashboardTask; stats?: DashboardData['stats'] });
        pushToast('Saved', message, 'success');
      } catch (error) {
        const text = error instanceof Error ? error.message : 'Failed to update task.';
        pushToast('Task update failed', text, 'error');
      } finally {
        setTaskMutationLoading(false);
      }
    },
    [applyTaskPayload, pushToast]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      setTaskMutationLoading(true);
      try {
        const response = await fetch(`/api/dashboard/task/${taskId}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        const payload = await response.json();
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || `Delete failed (${response.status})`);
        }

        setDashboardData((current) => ({
          ...current,
          tasks: current.tasks.filter((task) => task.id !== taskId),
          stats: payload.stats || current.stats,
        }));
        pushToast('Deleted', 'Task removed from dashboard.', 'info');
      } catch (error) {
        const text = error instanceof Error ? error.message : 'Failed to delete task.';
        pushToast('Delete failed', text, 'error');
      } finally {
        setTaskMutationLoading(false);
      }
    },
    [pushToast]
  );

  const deleteMeeting = useCallback(
    async (meetingId: string) => {
      setMeetingMutationLoading(true);
      try {
        const response = await fetch(`/api/dashboard/meeting/${meetingId}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        const payload = await response.json();
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || `Delete failed (${response.status})`);
        }

        setDashboardData((current) => ({
          ...current,
          meetings: current.meetings.filter((meeting) => meeting.id !== meetingId),
        }));
        pushToast('Deleted', 'Meeting summary removed.', 'info');
      } catch (error) {
        const text = error instanceof Error ? error.message : 'Failed to delete meeting summary.';
        pushToast('Delete failed', text, 'error');
      } finally {
        setMeetingMutationLoading(false);
      }
    },
    [pushToast]
  );

  const openEditTask = useCallback((task: DashboardTask) => {
    setEditingTask(task);
    setEditDraft({
      task: task.task,
      assignee: task.assignee,
      due_date_str: task.due_date_str,
      priority: task.priority,
      status: task.status,
      context_notes: task.context_notes,
    });
  }, []);

  const submitEditTask = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!editingTask) {
        return;
      }

      await updateTask(editingTask.id, editDraft, 'Task updated from editor');
      setEditingTask(null);
    },
    [editDraft, editingTask, updateTask]
  );

  const sendSummaryToTeam = useCallback(
    async (summaryId: string) => {
      setMeetingMutationLoading(true);
      try {
        const response = await fetch(`/api/teams/meeting/${summaryId}/send`, {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        const payload = (await response.json()) as { success?: boolean; error?: string; message?: string };
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || `Send failed (${response.status})`);
        }
        pushToast('Sent to team', payload.message || 'Summary delivered to team.', 'success');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not send summary.';
        pushToast('Send failed', message, 'error');
      } finally {
        setMeetingMutationLoading(false);
      }
    },
    [pushToast]
  );

  return (
    <>
      <main className="relative overflow-hidden px-6 py-8 md:px-8 md:py-12">
        <div className="pointer-events-none absolute inset-0">
          <motion.div
            className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl"
            animate={{ x: [0, 22, -10, 0], y: [0, -12, 10, 0], opacity: [0.25, 0.45, 0.35, 0.25] }}
            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute right-0 top-10 h-80 w-80 rounded-full bg-amber-400/18 blur-3xl"
            animate={{ x: [0, -24, 10, 0], y: [0, 14, -8, 0], opacity: [0.22, 0.4, 0.3, 0.22] }}
            transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_14%,rgba(255,255,255,0.08),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(245,158,11,0.09),transparent_40%)]" />
        </div>

        <div className="relative mx-auto max-w-7xl space-y-6">
          <section className="rounded-3xl border border-white/15 bg-[linear-gradient(160deg,rgba(18,18,22,0.9),rgba(8,8,11,0.96))] p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">Dashboard</h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-white/72 md:text-base">
                  This page is now fully automatic. It loads highlights, summaries, and tasks created from the Analyse flow.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void refreshDashboard(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/[0.05] px-4 py-2 text-sm text-white transition hover:border-white/50 hover:bg-white/[0.1]"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-5">
            <div className="rounded-2xl border border-white/15 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-white/55">High Priority</p>
              <p className="mt-2 text-3xl font-semibold text-amber-200">{counters.priority}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-white/55">Pending</p>
              <p className="mt-2 text-3xl font-semibold text-cyan-200">{counters.pending}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-white/55">In Progress</p>
              <p className="mt-2 text-3xl font-semibold text-violet-200">{counters.inProgress}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-white/55">Completed</p>
              <p className="mt-2 text-3xl font-semibold text-emerald-200">{counters.completed}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-white/55">Total Tasks</p>
              <p className="mt-2 text-3xl font-semibold text-white">{counters.total}</p>
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-[1.2fr_0.9fr]">
            <div className="rounded-3xl border border-white/15 bg-[linear-gradient(170deg,rgba(24,24,28,0.85),rgba(8,8,10,0.95))] p-5 md:p-6">
              <h2 className="text-xl font-semibold text-white">Task Board</h2>

              {dashboardLoading ? (
                <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm text-white/80">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Loading dashboard...
                </div>
              ) : dashboardError ? (
                <div className="mt-6 rounded-xl border border-rose-300/30 bg-rose-500/15 p-3 text-sm text-rose-100">{dashboardError}</div>
              ) : (
                <div className="mt-5 grid gap-3">
                  {dashboardData.tasks.length === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/65">
                      No tasks yet. Run analysis from the Analyse page and tasks will appear here automatically.
                    </div>
                  ) : (
                    dashboardData.tasks.map((task) => (
                      <div key={task.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{task.task}</p>
                            <p className="mt-1 text-xs text-white/60">
                              Owner: {task.assignee || 'Unassigned'} | Due: {task.due_date_str || 'Not specified'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditTask(task)}
                              className="rounded-md border border-white/20 p-2 text-white/80 transition hover:bg-white/[0.08]"
                              disabled={taskMutationLoading}
                            >
                              <PenLine className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteTask(task.id)}
                              className="rounded-md border border-rose-300/35 p-2 text-rose-100 transition hover:bg-rose-500/20"
                              disabled={taskMutationLoading}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          <select
                            value={task.priority}
                            onChange={(event) =>
                              void updateTask(task.id, { priority: event.target.value as TaskPriority }, 'Priority updated')
                            }
                            className="rounded-lg border border-white/20 bg-black/35 px-3 py-2 text-sm text-white"
                            disabled={taskMutationLoading}
                          >
                            <option value="high">High Priority</option>
                            <option value="medium">Medium Priority</option>
                            <option value="low">Low Priority</option>
                          </select>
                          <select
                            value={task.status}
                            onChange={(event) =>
                              void updateTask(task.id, { status: event.target.value as TaskStatus }, 'Status updated')
                            }
                            className="rounded-lg border border-white/20 bg-black/35 px-3 py-2 text-sm text-white"
                            disabled={taskMutationLoading}
                          >
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="done">Completed</option>
                          </select>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-white/70">
                            {priorityLabel(task.priority)}
                          </span>
                          <span className="rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-white/70">
                            {statusLabel(task.status)}
                          </span>
                        </div>

                        {task.context_notes ? (
                          <p className="mt-3 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/65">
                            {task.context_notes}
                          </p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-4">
              <section className="rounded-3xl border border-white/15 bg-white/[0.03] p-5">
                <h3 className="text-lg font-semibold text-white">AI Highlights</h3>
                <ul className="mt-4 grid gap-2 text-sm text-white/72">
                  {(dashboardData.highlights || []).length === 0 ? (
                    <li className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">No highlights yet. Analyse a meeting to populate this panel.</li>
                  ) : (
                    dashboardData.highlights.map((line) => (
                      <li key={line} className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                        {line}
                      </li>
                    ))
                  )}
                </ul>
              </section>

              <section className="rounded-3xl border border-white/15 bg-white/[0.03] p-5">
                <h3 className="text-lg font-semibold text-white">Meeting Summaries</h3>
                <div className="mt-4 grid gap-3">
                  {(dashboardData.meetings || []).length === 0 ? (
                    <p className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white/65">No meeting summaries saved yet.</p>
                  ) : (
                    dashboardData.meetings.slice(0, 8).map((meeting) => (
                      <div key={meeting.id} className="rounded-xl border border-white/10 bg-black/25 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-white">{meeting.title}</p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => void sendSummaryToTeam(meeting.id)}
                              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300/35 px-2 py-1.5 text-xs text-emerald-100 transition hover:bg-emerald-500/20"
                              disabled={meetingMutationLoading}
                            >
                              <Send className="h-3.5 w-3.5" />
                              Send to team
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteMeeting(meeting.id)}
                              className="rounded-md border border-rose-300/35 p-1.5 text-rose-100 transition hover:bg-rose-500/20"
                              disabled={meetingMutationLoading}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-white/65">{meeting.summary}</p>
                        {(meeting.topics || []).length > 0 ? (
                          <p className="mt-2 text-[11px] text-cyan-100/85">Topics: {meeting.topics.join(' • ')}</p>
                        ) : null}
                        {(meeting.decisions || []).length > 0 ? (
                          <p className="mt-1 text-[11px] text-amber-100/85">Decisions: {meeting.decisions.join(' • ')}</p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </section>
        </div>
      </main>

      <AnimatePresence>
        {editingTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[85] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
          >
            <motion.form
              onSubmit={submitEditTask}
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 8, opacity: 0 }}
              className="w-full max-w-2xl rounded-2xl border border-white/15 bg-[#0e0e12] p-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Edit Task</h3>
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="rounded-md border border-white/20 p-1.5 text-white/80 hover:bg-white/[0.08]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 grid gap-3">
                <input
                  value={editDraft.task}
                  onChange={(event) => setEditDraft((current) => ({ ...current, task: event.target.value }))}
                  className="rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white"
                  placeholder="Task"
                  required
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={editDraft.assignee}
                    onChange={(event) => setEditDraft((current) => ({ ...current, assignee: event.target.value }))}
                    className="rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white"
                    placeholder="Assignee"
                  />
                  <input
                    value={editDraft.due_date_str}
                    onChange={(event) => setEditDraft((current) => ({ ...current, due_date_str: event.target.value }))}
                    className="rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white"
                    placeholder="Due date"
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <select
                    value={editDraft.priority}
                    onChange={(event) => setEditDraft((current) => ({ ...current, priority: event.target.value as TaskPriority }))}
                    className="rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <select
                    value={editDraft.status}
                    onChange={(event) => setEditDraft((current) => ({ ...current, status: event.target.value as TaskStatus }))}
                    className="rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Completed</option>
                  </select>
                </div>
                <textarea
                  value={editDraft.context_notes}
                  onChange={(event) => setEditDraft((current) => ({ ...current, context_notes: event.target.value }))}
                  className="min-h-24 rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white"
                  placeholder="Context notes"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/[0.08]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={taskMutationLoading}
                  className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200 disabled:opacity-60"
                >
                  Save changes
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-none fixed right-4 top-20 z-[95] flex w-full max-w-sm flex-col gap-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 20, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto rounded-xl border px-4 py-3 shadow-[0_18px_45px_-28px_rgba(0,0,0,0.95)] ${toastToneClass[toast.tone]}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{toast.title}</p>
                  <p className="mt-1 text-xs leading-5 text-white/85">{toast.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  className="rounded-md border border-white/20 p-1 text-white/80 transition hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
