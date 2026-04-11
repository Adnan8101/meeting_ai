import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, CheckCircle2, ExternalLink, LoaderCircle, PlugZap, X } from 'lucide-react';

type ToastTone = 'success' | 'error' | 'info';

type ToastItem = {
  id: number;
  title: string;
  message: string;
  tone: ToastTone;
};

type IntegrationStatusPayload = {
  success: boolean;
  integrations?: {
    trello_connected?: boolean;
    trello_account?: string | null;
    jira_connected?: boolean;
    jira_account?: string | null;
    jira_url?: string | null;
  };
  error?: string;
};

type TrelloTokenUrlResponse = {
  success?: boolean;
  url?: string;
  error?: string;
};

const toastToneClass: Record<ToastTone, string> = {
  success: 'border-emerald-300/35 bg-emerald-500/15 text-emerald-100',
  error: 'border-rose-300/35 bg-rose-500/15 text-rose-100',
  info: 'border-sky-300/35 bg-sky-500/15 text-sky-100',
};

export default function IntegrationsPage() {
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState('');
  const [trelloConnected, setTrelloConnected] = useState(false);
  const [jiraConnected, setJiraConnected] = useState(false);
  const [trelloAccount, setTrelloAccount] = useState('');
  const [jiraAccount, setJiraAccount] = useState('');
  const [jiraUrl, setJiraUrl] = useState('');

  const [trelloToken, setTrelloToken] = useState('');
  const [jiraEmailInput, setJiraEmailInput] = useState('');
  const [jiraUrlInput, setJiraUrlInput] = useState('');
  const [jiraTokenInput, setJiraTokenInput] = useState('');

  const [trelloSubmitting, setTrelloSubmitting] = useState(false);
  const [trelloDisconnecting, setTrelloDisconnecting] = useState(false);
  const [trelloTokenPageLoading, setTrelloTokenPageLoading] = useState(false);
  const [jiraSubmitting, setJiraSubmitting] = useState(false);

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

  const refreshStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError('');

    try {
      const response = await fetch('/api/integrations/status', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      const payload = (await response.json()) as IntegrationStatusPayload;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || `Failed to load integrations (${response.status})`);
      }

      const integrations = payload.integrations || {};
      setTrelloConnected(Boolean(integrations.trello_connected));
      setJiraConnected(Boolean(integrations.jira_connected));
      setTrelloAccount(integrations.trello_account || '');
      setJiraAccount(integrations.jira_account || '');
      setJiraUrl(integrations.jira_url || '');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load integration status.';
      setStatusError(message);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const connectTrello = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!trelloToken.trim()) {
        pushToast('Token required', 'Paste your Trello token before connecting.', 'error');
        return;
      }

      setTrelloSubmitting(true);
      try {
        const response = await fetch('/api/chat/connect/trello', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            trello_token: trelloToken.trim(),
            confirm: true,
          }),
        });

        const payload = await response.json();
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || `Trello connect failed (${response.status})`);
        }

        pushToast('Trello connected', payload.message || 'Trello integration is now active.', 'success');
        setTrelloToken('');
        await refreshStatus();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to connect Trello.';
        pushToast('Trello connection failed', message, 'error');
      } finally {
        setTrelloSubmitting(false);
      }
    },
    [pushToast, refreshStatus, trelloToken]
  );

  const connectJira = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!jiraUrlInput.trim() || !jiraEmailInput.trim() || !jiraTokenInput.trim()) {
        pushToast('Missing fields', 'Provide Jira URL, email, and API token.', 'error');
        return;
      }

      setJiraSubmitting(true);
      try {
        const response = await fetch('/api/chat/connect/jira', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            jira_url: jiraUrlInput.trim(),
            jira_email: jiraEmailInput.trim(),
            jira_api_token: jiraTokenInput.trim(),
            confirm: true,
          }),
        });

        const payload = await response.json();
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || `Jira connect failed (${response.status})`);
        }

        pushToast('Jira connected', payload.message || 'Jira integration is now active.', 'success');
        setJiraTokenInput('');
        await refreshStatus();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to connect Jira.';
        pushToast('Jira connection failed', message, 'error');
      } finally {
        setJiraSubmitting(false);
      }
    },
    [jiraEmailInput, jiraTokenInput, jiraUrlInput, pushToast, refreshStatus]
  );

  const disconnectTrello = useCallback(async () => {
    setTrelloDisconnecting(true);
    try {
      const response = await fetch('/api/chat/disconnect/trello', {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || `Trello disconnect failed (${response.status})`);
      }

      pushToast('Trello disconnected', payload.message || 'Trello integration has been removed.', 'info');
      await refreshStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to disconnect Trello.';
      pushToast('Disconnect failed', message, 'error');
    } finally {
      setTrelloDisconnecting(false);
    }
  }, [pushToast, refreshStatus]);

  const openTrelloTokenPage = useCallback(async () => {
    setTrelloTokenPageLoading(true);
    try {
      const response = await fetch('/api/integrations/trello-token-url', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      const payload = (await response.json()) as TrelloTokenUrlResponse;
      if (!response.ok || !payload?.success || !payload.url) {
        throw new Error(payload?.error || `Unable to open Trello token page (${response.status})`);
      }

      const popup = window.open(payload.url, '_blank', 'noopener,noreferrer');
      if (!popup) {
        window.location.href = payload.url;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to open Trello token page.';
      pushToast('Trello link failed', message, 'error');
    } finally {
      setTrelloTokenPageLoading(false);
    }
  }, [pushToast]);

  return (
    <>
      <main className="relative overflow-hidden px-6 py-10 md:px-8 md:py-12">
        <div className="pointer-events-none absolute inset-0">
          <motion.div
            className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl"
            animate={{ x: [0, 24, -10, 0], y: [0, -10, 12, 0], opacity: [0.25, 0.45, 0.35, 0.25] }}
            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute right-0 top-8 h-80 w-80 rounded-full bg-cyan-400/18 blur-3xl"
            animate={{ x: [0, -24, 8, 0], y: [0, 14, -8, 0], opacity: [0.22, 0.4, 0.32, 0.22] }}
            transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        <div className="relative mx-auto max-w-7xl space-y-6">
          <section className="rounded-3xl border border-white/15 bg-[linear-gradient(160deg,rgba(18,18,22,0.9),rgba(8,8,11,0.96))] p-6 md:p-8">
            <p className="text-xs uppercase tracking-[0.15em] text-emerald-200">Integrations</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">Connect Jira and Trello</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/72 md:text-base">
              Slack and Google Calendar have been removed. This page now focuses on production-ready Jira and Trello
              connection steps, with validation and status checks.
            </p>
          </section>

          {statusLoading ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm text-white/80">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading integration status...
            </div>
          ) : statusError ? (
            <div className="rounded-xl border border-rose-300/30 bg-rose-500/15 p-3 text-sm text-rose-100">{statusError}</div>
          ) : null}

          <section className="grid gap-5 lg:grid-cols-2">
            <article className="rounded-3xl border border-white/15 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-white">Trello</h2>
                <span className={`rounded-full border px-2.5 py-1 text-xs ${trelloConnected ? 'border-emerald-300/35 bg-emerald-500/20 text-emerald-100' : 'border-white/20 bg-black/35 text-white/70'}`}>
                  {trelloConnected ? 'Connected' : 'Not Connected'}
                </span>
              </div>

              {trelloConnected ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-emerald-300/25 bg-emerald-500/10 p-4">
                    <p className="text-sm font-semibold text-emerald-100">Connected account</p>
                    <p className="mt-1 text-sm text-emerald-50/90">{trelloAccount || 'Trello user'}</p>
                    <p className="mt-2 text-xs text-emerald-100/80">
                      Trello integration is active and ready for automatic task/card creation.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void disconnectTrello()}
                    disabled={trelloDisconnecting}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300/35 bg-rose-500/15 px-4 py-2.5 text-sm font-medium text-rose-50 transition hover:bg-rose-500/25 disabled:opacity-60"
                  >
                    {trelloDisconnecting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                    Disconnect Trello
                  </button>
                </div>
              ) : (
                <>
                  <ol className="mt-4 grid gap-2 text-sm text-white/72">
                    <li className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">1. Open Trello auth page to generate your token.</li>
                    <li className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">2. Copy token from Trello and paste below.</li>
                    <li className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">3. Click Connect Trello to verify and save credentials.</li>
                  </ol>

                  <button
                    type="button"
                    onClick={() => void openTrelloTokenPage()}
                    disabled={trelloTokenPageLoading}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/[0.05] px-4 py-2 text-sm text-white transition hover:border-white/50 hover:bg-white/[0.1] disabled:opacity-60"
                  >
                    {trelloTokenPageLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                    Open Trello Token Approve Page
                  </button>

                  <form className="mt-4 grid gap-3" onSubmit={connectTrello}>
                    <input
                      value={trelloToken}
                      onChange={(event) => setTrelloToken(event.target.value)}
                      placeholder="Paste Trello token"
                      className="rounded-lg border border-white/20 bg-black/35 px-3 py-2 text-sm text-white"
                    />
                    <button
                      type="submit"
                      disabled={trelloSubmitting}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:opacity-60"
                    >
                      {trelloSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                      Connect Trello
                    </button>
                  </form>
                </>
              )}
            </article>

            <article className="rounded-3xl border border-white/15 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-white">Jira</h2>
                <span className={`rounded-full border px-2.5 py-1 text-xs ${jiraConnected ? 'border-emerald-300/35 bg-emerald-500/20 text-emerald-100' : 'border-white/20 bg-black/35 text-white/70'}`}>
                  {jiraConnected ? 'Connected' : 'Not Connected'}
                </span>
              </div>

              <ol className="mt-4 grid gap-2 text-sm text-white/72">
                <li className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">1. Use Jira cloud URL (https://your-domain.atlassian.net).</li>
                <li className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">2. Use your Jira account email.</li>
                <li className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">3. Generate and paste Jira API token, then connect.</li>
              </ol>

              <a
                href="https://id.atlassian.com/login?continue=https%3A%2F%2Fid.atlassian.com%2Fmanage-profile%2Fsecurity%2Fapi-tokens"
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/[0.05] px-4 py-2 text-sm text-white transition hover:border-white/50 hover:bg-white/[0.1]"
              >
                Sign In to Jira and Open API Token Page
                <ExternalLink className="h-4 w-4" />
              </a>

              <form className="mt-4 grid gap-3" onSubmit={connectJira}>
                <input
                  value={jiraUrlInput}
                  onChange={(event) => setJiraUrlInput(event.target.value)}
                  placeholder="https://your-domain.atlassian.net"
                  className="rounded-lg border border-white/20 bg-black/35 px-3 py-2 text-sm text-white"
                />
                <input
                  value={jiraEmailInput}
                  onChange={(event) => setJiraEmailInput(event.target.value)}
                  placeholder="Jira account email"
                  className="rounded-lg border border-white/20 bg-black/35 px-3 py-2 text-sm text-white"
                />
                <input
                  value={jiraTokenInput}
                  onChange={(event) => setJiraTokenInput(event.target.value)}
                  placeholder="Jira API token"
                  className="rounded-lg border border-white/20 bg-black/35 px-3 py-2 text-sm text-white"
                />
                <button
                  type="submit"
                  disabled={jiraSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:opacity-60"
                >
                  {jiraSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                  Connect Jira
                </button>
              </form>

              {jiraConnected ? (
                <p className="mt-3 text-xs text-emerald-100/90">
                  Connected account: {jiraAccount || 'Jira user'} {jiraUrl ? `(${jiraUrl})` : ''}
                </p>
              ) : null}
            </article>
          </section>

          <section className="rounded-3xl border border-cyan-300/20 bg-cyan-500/10 p-5 md:p-6">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-cyan-200" />
              <h2 className="text-lg font-semibold text-cyan-100">AI Personal Assistant</h2>
            </div>
            <p className="mt-3 text-sm leading-7 text-cyan-50/90">
              Morning briefing workflow is planned here: when users log in, they will receive pending tasks, priorities,
              and urgent blockers generated from structured meeting data.
            </p>
            <div className="mt-4 grid gap-2 text-sm text-cyan-50/90 md:grid-cols-3">
              <div className="rounded-lg border border-cyan-200/25 bg-black/20 px-3 py-2">Structured tasks and deadlines</div>
              <div className="rounded-lg border border-cyan-200/25 bg-black/20 px-3 py-2">Priority-first morning briefing</div>
              <div className="rounded-lg border border-cyan-200/25 bg-black/20 px-3 py-2">Execution reminders on login</div>
            </div>
          </section>
        </div>
      </main>

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
                  {toast.tone === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <X className="h-4 w-4" />}
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
