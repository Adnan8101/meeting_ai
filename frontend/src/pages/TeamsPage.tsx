import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  Copy,
  LoaderCircle,
  LogOut,
  Send,
  Trash2,
  UserMinus,
  Users,
  X,
} from 'lucide-react';

type TeamInfo = {
  id: string;
  name: string;
  join_code: string | null;
  owner_id: string;
  is_owner: boolean;
};

type TeamMember = {
  id: string;
  username: string;
  email: string;
};

type TeamSummary = {
  id: string;
  title: string;
  summary: string;
  topics: string[];
  decisions: string[];
  created_at: string | null;
  owner_id: string;
};

type TeamTask = {
  id: string;
  meeting_id: string | null;
  task: string;
  assignee: string;
  due_date_str: string;
  priority: string;
  status: string;
  context_notes: string;
  created_at: string | null;
  updated_at: string | null;
};

type TeamContextPayload = {
  success?: boolean;
  error?: string;
  warning?: string;
  team?: TeamInfo | null;
  members?: TeamMember[];
  summaries?: TeamSummary[];
  tasks?: TeamTask[];
};

type ToastTone = 'success' | 'error' | 'info';

type ToastItem = {
  id: number;
  title: string;
  message: string;
  tone: ToastTone;
};

type SummaryDraft = {
  title: string;
  summary: string;
};

const toastToneClass: Record<ToastTone, string> = {
  success: 'border-emerald-300/35 bg-emerald-500/15 text-emerald-100',
  error: 'border-rose-300/35 bg-rose-500/15 text-rose-100',
  info: 'border-sky-300/35 bg-sky-500/15 text-sky-100',
};

function formatTimestamp(value: string | null) {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleString();
}

export default function TeamsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [summaries, setSummaries] = useState<TeamSummary[]>([]);
  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [activeTab, setActiveTab] = useState<'summaries' | 'tasks'>('summaries');

  const [createName, setCreateName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [mutationLoading, setMutationLoading] = useState(false);

  const [editingSummary, setEditingSummary] = useState<TeamSummary | null>(null);
  const [summaryDraft, setSummaryDraft] = useState<SummaryDraft>({ title: '', summary: '' });

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

  const refreshTeamContext = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/teams/context', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      const payload = (await response.json()) as TeamContextPayload;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || `Failed to load team context (${response.status})`);
      }
      setTeam(payload.team || null);
      setMembers(payload.members || []);
      setSummaries(payload.summaries || []);
      setTasks(payload.tasks || []);
      if (payload.warning) {
        pushToast('Notice', payload.warning, 'info');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load team context.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void refreshTeamContext();
  }, [refreshTeamContext]);

  const createTeam = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!createName.trim()) {
        pushToast('Team name required', 'Enter a team name to continue.', 'error');
        return;
      }
      setMutationLoading(true);
      try {
        const response = await fetch('/api/teams/create', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ name: createName.trim() }),
        });
        const payload = (await response.json()) as TeamContextPayload;
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || `Create team failed (${response.status})`);
        }
        setCreateName('');
        pushToast('Team created', 'Your new team is ready.', 'success');
        await refreshTeamContext();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not create team.';
        pushToast('Create failed', message, 'error');
      } finally {
        setMutationLoading(false);
      }
    },
    [createName, pushToast, refreshTeamContext]
  );

  const joinTeam = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!joinCode.trim()) {
        pushToast('Join code required', 'Enter the 6-character team code.', 'error');
        return;
      }
      setMutationLoading(true);
      try {
        const response = await fetch('/api/teams/join', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ join_code: joinCode.trim() }),
        });
        const payload = (await response.json()) as TeamContextPayload;
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || `Join team failed (${response.status})`);
        }
        setJoinCode('');
        pushToast('Joined team', 'You are now part of the team.', 'success');
        await refreshTeamContext();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not join team.';
        pushToast('Join failed', message, 'error');
      } finally {
        setMutationLoading(false);
      }
    },
    [joinCode, pushToast, refreshTeamContext]
  );

  const copyJoinCode = useCallback(async () => {
    if (!team?.join_code) return;
    try {
      await navigator.clipboard.writeText(team.join_code);
      pushToast('Copied', 'Join code copied to clipboard.', 'success');
    } catch {
      pushToast('Copy failed', 'Unable to copy join code.', 'error');
    }
  }, [pushToast, team]);

  const openEditSummary = useCallback((summary: TeamSummary) => {
    setEditingSummary(summary);
    setSummaryDraft({ title: summary.title, summary: summary.summary });
  }, []);

  const closeEditSummary = useCallback(() => {
    setEditingSummary(null);
    setSummaryDraft({ title: '', summary: '' });
  }, []);

  const updateSummary = useCallback(async () => {
    if (!editingSummary) return;
    if (!summaryDraft.title.trim() || !summaryDraft.summary.trim()) {
      pushToast('Missing fields', 'Provide both title and summary.', 'error');
      return;
    }
    setMutationLoading(true);
    try {
      const response = await fetch(`/api/teams/meeting/${editingSummary.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          title: summaryDraft.title.trim(),
          summary: summaryDraft.summary.trim(),
        }),
      });
      const payload = (await response.json()) as { success?: boolean; error?: string; meeting?: TeamSummary };
      if (!response.ok || !payload.success || !payload.meeting) {
        throw new Error(payload.error || `Update failed (${response.status})`);
      }
      setSummaries((current) => current.map((item) => (item.id === payload.meeting!.id ? payload.meeting! : item)));
      pushToast('Updated', 'Summary updated successfully.', 'success');
      closeEditSummary();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not update summary.';
      pushToast('Update failed', message, 'error');
    } finally {
      setMutationLoading(false);
    }
  }, [closeEditSummary, editingSummary, pushToast, summaryDraft.summary, summaryDraft.title]);

  const deleteSummary = useCallback(
    async (summaryId: string) => {
      setMutationLoading(true);
      try {
        const response = await fetch(`/api/teams/meeting/${summaryId}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        const payload = (await response.json()) as { success?: boolean; error?: string };
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || `Delete failed (${response.status})`);
        }
        setSummaries((current) => current.filter((item) => item.id !== summaryId));
        setTasks((current) => current.filter((item) => item.meeting_id !== summaryId));
        pushToast('Deleted', 'Summary removed.', 'info');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not delete summary.';
        pushToast('Delete failed', message, 'error');
      } finally {
        setMutationLoading(false);
      }
    },
    [pushToast]
  );

  const sendSummaryToTeam = useCallback(
    async (summaryId: string) => {
      setMutationLoading(true);
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
        pushToast('Sent', payload.message || 'Summary delivered to team.', 'success');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not send summary.';
        pushToast('Send failed', message, 'error');
      } finally {
        setMutationLoading(false);
      }
    },
    [pushToast]
  );

  const assignTask = useCallback(
    async (taskId: string, assignee: string) => {
      setMutationLoading(true);
      try {
        const response = await fetch(`/api/teams/task/${taskId}/assign`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ assignee }),
        });
        const payload = (await response.json()) as { success?: boolean; error?: string; task?: TeamTask };
        if (!response.ok || !payload.success || !payload.task) {
          throw new Error(payload.error || `Assign failed (${response.status})`);
        }
        setTasks((current) => current.map((item) => (item.id === payload.task!.id ? payload.task! : item)));
        pushToast('Assigned', 'Task owner updated.', 'success');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not assign task.';
        pushToast('Assign failed', message, 'error');
      } finally {
        setMutationLoading(false);
      }
    },
    [pushToast]
  );

  const memberOptions = useMemo(() => members.map((member) => member.username), [members]);

  const leaveTeam = useCallback(async () => {
    if (!window.confirm('Are you sure you want to leave this team?')) return;
    setMutationLoading(true);
    try {
      const response = await fetch('/api/teams/leave', {
        method: 'DELETE',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      const payload = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || `Leave failed (${response.status})`);
      }
      pushToast('Left team', 'You have left the team.', 'info');
      await refreshTeamContext();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not leave team.';
      pushToast('Leave failed', message, 'error');
    } finally {
      setMutationLoading(false);
    }
  }, [pushToast, refreshTeamContext]);

  const deleteTeam = useCallback(async () => {
    if (!window.confirm('Are you sure you want to delete this team? All shared data will be removed.')) return;
    setMutationLoading(true);
    try {
      const response = await fetch('/api/teams/delete', {
        method: 'DELETE',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      const payload = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || `Delete failed (${response.status})`);
      }
      pushToast('Team deleted', 'The team has been permanently deleted.', 'info');
      await refreshTeamContext();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not delete team.';
      pushToast('Delete failed', message, 'error');
    } finally {
      setMutationLoading(false);
    }
  }, [pushToast, refreshTeamContext]);

  const removeMember = useCallback(
    async (userId: string, username: string) => {
      if (!window.confirm(`Remove ${username} from the team?`)) return;
      setMutationLoading(true);
      try {
        const response = await fetch(`/api/teams/member/${userId}/remove`, {
          method: 'DELETE',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        const payload = (await response.json()) as { success?: boolean; error?: string; message?: string };
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || `Remove failed (${response.status})`);
        }
        pushToast('Removed', payload.message || `${username} removed.`, 'info');
        await refreshTeamContext();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not remove member.';
        pushToast('Remove failed', message, 'error');
      } finally {
        setMutationLoading(false);
      }
    },
    [pushToast, refreshTeamContext]
  );

  return (
    <>
      <main className="relative overflow-hidden px-6 py-10 md:px-8 md:py-12">
        <div className="pointer-events-none absolute inset-0">
          <motion.div
            className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-emerald-400/18 blur-3xl"
            animate={{ x: [0, 24, -10, 0], y: [0, -10, 12, 0], opacity: [0.2, 0.4, 0.35, 0.2] }}
            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute right-0 top-8 h-80 w-80 rounded-full bg-amber-400/18 blur-3xl"
            animate={{ x: [0, -24, 8, 0], y: [0, 14, -8, 0], opacity: [0.2, 0.35, 0.32, 0.2] }}
            transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        <div className="relative mx-auto max-w-6xl space-y-6">
          <section className="rounded-3xl border border-white/15 bg-[linear-gradient(160deg,rgba(22,22,25,0.88),rgba(8,8,12,0.96))] p-6 md:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-white/70">
                <Users className="h-3.5 w-3.5" />
                Team Workspace
              </span>
              {team ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100">
                  Active team: {team.name}
                </span>
              ) : null}
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">Team Hub</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70 md:text-base">
              Create or join a team, share summaries, and coordinate tasks in one place.
            </p>
          </section>

          {loading ? (
            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
              <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-white/70" />
              <p className="mt-3 text-sm text-white/65">Loading team context...</p>
            </section>
          ) : error ? (
            <section className="rounded-3xl border border-rose-300/30 bg-rose-500/10 p-6 text-rose-100">
              <p className="text-sm">{error}</p>
            </section>
          ) : team ? (
            <>
              <section className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-3xl border border-white/15 bg-white/[0.04] p-6">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/60">Team Code</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <div className="rounded-2xl border border-white/20 bg-black/40 px-5 py-3 text-2xl font-semibold tracking-[0.3em] text-white">
                      {team.join_code || '------'}
                    </div>
                    <button
                      type="button"
                      onClick={copyJoinCode}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm text-white/80 transition hover:border-white/50 hover:bg-white/10"
                    >
                      <Copy className="h-4 w-4" />
                      Copy code
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-white/60">Share this code to invite teammates.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {team.is_owner ? (
                      <button
                        type="button"
                        onClick={deleteTeam}
                        className="inline-flex items-center gap-2 rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-100 transition hover:bg-rose-500/20"
                        disabled={mutationLoading}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete Team
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={leaveTeam}
                        className="inline-flex items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-100 transition hover:bg-amber-500/20"
                        disabled={mutationLoading}
                      >
                        <LogOut className="h-4 w-4" />
                        Leave Team
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/15 bg-white/[0.04] p-6">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/60">Members</p>
                  <div className="mt-4 space-y-2">
                    {members.map((member) => (
                      <div key={member.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{member.username}</p>
                          <p className="text-xs text-white/60">{member.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {team.owner_id === member.id ? (
                            <span className="rounded-full border border-amber-300/30 bg-amber-500/15 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-amber-100">
                              Leader
                            </span>
                          ) : team.is_owner ? (
                            <button
                              type="button"
                              onClick={() => removeMember(member.id, member.username)}
                              className="inline-flex items-center gap-1.5 rounded-full border border-rose-300/25 px-3 py-1 text-[11px] text-rose-200 transition hover:bg-rose-500/15"
                              disabled={mutationLoading}
                            >
                              <UserMinus className="h-3 w-3" />
                              Remove
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-white/15 bg-white/[0.03] p-6">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('summaries')}
                    className={`rounded-full border px-4 py-2 text-sm transition ${
                      activeTab === 'summaries'
                        ? 'border-white bg-white text-black'
                        : 'border-white/25 text-white/80 hover:border-white/60'
                    }`}
                  >
                    Summary
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('tasks')}
                    className={`rounded-full border px-4 py-2 text-sm transition ${
                      activeTab === 'tasks'
                        ? 'border-white bg-white text-black'
                        : 'border-white/25 text-white/80 hover:border-white/60'
                    }`}
                  >
                    Tasks
                  </button>
                </div>

                {activeTab === 'summaries' ? (
                  <div className="mt-6 space-y-4">
                    {summaries.length === 0 ? (
                      <p className="text-sm text-white/60">No summaries yet. Run an analysis to generate one.</p>
                    ) : (
                      summaries.map((summary) => (
                        <div key={summary.id} className="rounded-3xl border border-white/10 bg-black/45 p-5">
                          <div>
                            <p className="text-sm uppercase tracking-[0.14em] text-white/50">{formatTimestamp(summary.created_at)}</p>
                            <h3 className="mt-2 text-lg font-semibold text-white">{summary.title}</h3>
                          </div>
                          <p className="mt-3 text-sm leading-7 text-white/70">{summary.summary}</p>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    {tasks.length === 0 ? (
                      <p className="text-sm text-white/60">No team tasks yet.</p>
                    ) : (
                      tasks.map((task) => (
                        <div key={task.id} className="rounded-3xl border border-white/10 bg-black/45 p-5">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <p className="text-xs uppercase tracking-[0.14em] text-white/50">{task.status.replace('_', ' ')}</p>
                              <h3 className="mt-2 text-base font-semibold text-white">{task.task}</h3>
                              <p className="mt-2 text-xs text-white/60">Due: {task.due_date_str || 'Not set'} | Priority: {task.priority}</p>
                            </div>
                            <div className="flex flex-col gap-2">
                              <span className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs text-white/70">
                                Assignee: {task.assignee || 'Unassigned'}
                              </span>
                              {team.is_owner ? (
                                <div className="flex items-center gap-2">
                                  <select
                                    className="rounded-xl border border-white/20 bg-black/60 px-3 py-2 text-xs text-white"
                                    defaultValue={task.assignee || ''}
                                    onChange={(event) => {
                                      const next = event.target.value;
                                      if (!next || next === task.assignee) {
                                        return;
                                      }
                                      void assignTask(task.id, next);
                                    }}
                                    disabled={mutationLoading}
                                  >
                                    <option value="">Unassigned</option>
                                    {memberOptions.map((member) => (
                                      <option key={member} value={member}>
                                        {member}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ) : null}
                            </div>
                          </div>
                          {task.context_notes ? <p className="mt-3 text-sm text-white/60">{task.context_notes}</p> : null}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </section>
            </>
          ) : (
            <section className="grid gap-6 md:grid-cols-2">
              <form onSubmit={createTeam} className="rounded-3xl border border-white/15 bg-white/[0.04] p-6">
                <p className="text-xs uppercase tracking-[0.16em] text-white/60">Create Team</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Start a new space</h2>
                <p className="mt-2 text-sm text-white/65">Generate a join code and invite your teammates.</p>
                <input
                  type="text"
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  placeholder="Team name"
                  className="mt-4 w-full rounded-2xl border border-white/20 bg-black/50 px-4 py-3 text-sm text-white outline-none"
                />
                <button
                  type="submit"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200"
                  disabled={mutationLoading}
                >
                  {mutationLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Create team
                </button>
              </form>

              <form onSubmit={joinTeam} className="rounded-3xl border border-white/15 bg-white/[0.04] p-6">
                <p className="text-xs uppercase tracking-[0.16em] text-white/60">Join Team</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Enter invite code</h2>
                <p className="mt-2 text-sm text-white/65">Use the 6-character team code to join.</p>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value)}
                  placeholder="ABC123"
                  className="mt-4 w-full rounded-2xl border border-white/20 bg-black/50 px-4 py-3 text-sm text-white outline-none"
                />
                <button
                  type="submit"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm text-white/80 transition hover:border-white/60"
                  disabled={mutationLoading}
                >
                  {mutationLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Join team
                </button>
              </form>
            </section>
          )}
        </div>
      </main>

      <AnimatePresence>
        {editingSummary && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[85] flex items-center justify-center bg-black/70 p-5 backdrop-blur"
          >
            <motion.section
              initial={{ scale: 0.98, y: 12, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.98, y: 12, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 22 }}
              className="w-full max-w-xl rounded-3xl border border-white/15 bg-[#0d0d12] p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-white/60">Edit Summary</p>
                  <h3 className="mt-2 text-lg font-semibold text-white">Update meeting summary</h3>
                </div>
                <button
                  type="button"
                  onClick={closeEditSummary}
                  className="rounded-lg border border-white/20 p-2 text-white/70"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 grid gap-3">
                <input
                  type="text"
                  value={summaryDraft.title}
                  onChange={(event) => setSummaryDraft((current) => ({ ...current, title: event.target.value }))}
                  className="w-full rounded-2xl border border-white/20 bg-black/50 px-4 py-3 text-sm text-white outline-none"
                  placeholder="Title"
                />
                <textarea
                  value={summaryDraft.summary}
                  onChange={(event) => setSummaryDraft((current) => ({ ...current, summary: event.target.value }))}
                  className="min-h-32 w-full rounded-2xl border border-white/20 bg-black/50 px-4 py-3 text-sm text-white outline-none"
                  placeholder="Summary"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEditSummary}
                  className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/80"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={updateSummary}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black"
                  disabled={mutationLoading}
                >
                  Save
                </button>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-none fixed right-4 top-20 z-[90] flex w-full max-w-sm flex-col gap-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 24, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.98 }}
              transition={{ duration: 0.22 }}
              className={`pointer-events-auto rounded-xl border px-4 py-3 shadow-[0_18px_45px_-30px_rgba(0,0,0,0.95)] ${toastToneClass[toast.tone]}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{toast.title}</p>
                  <p className="mt-1 text-xs leading-5 text-white/85">{toast.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  className="rounded-md border border-white/25 p-1 text-white/80 transition hover:bg-white/10"
                  aria-label="Dismiss notification"
                >
                  {toast.tone === 'success' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : toast.tone === 'error' ? (
                    <X className="h-4 w-4" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
