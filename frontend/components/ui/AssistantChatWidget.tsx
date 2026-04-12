import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, LoaderCircle, Send, Trash2, X } from 'lucide-react';

type ChatRole = 'user' | 'assistant';

type ChatMessage = {
  role: ChatRole;
  content: string;
  created_at?: string;
  selected_model?: string;
  actual_model?: string;
};

type ChatHistoryResponse = {
  success?: boolean;
  history?: ChatMessage[];
  user_name?: string;
};

type ChatSendResponse = {
  success?: boolean;
  reply?: string;
  selected_model?: string;
  actual_model?: string;
  user_name?: string;
  error?: string;
};

type AssistantChatWidgetProps = {
  visible: boolean;
};

const DEFAULT_CHAT_MODEL = 'gemini-3-flash';

export default function AssistantChatWidget({ visible }: AssistantChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [userName, setUserName] = useState('');

  const listRef = useRef<HTMLDivElement | null>(null);

  const canSend = Boolean(input.trim()) && !sending;

  const scrollToBottom = useCallback(() => {
    if (!listRef.current) {
      return;
    }
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    window.setTimeout(scrollToBottom, 30);
  }, [messages, open, scrollToBottom]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const response = await fetch('/api/ai-chat/history', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      const payload = (await response.json()) as ChatHistoryResponse;

      if (!response.ok || !payload?.success) {
        throw new Error('Unable to load assistant history.');
      }

      setMessages(payload.history || []);
      setUserName(payload.user_name || '');
    } catch {
      setMessages([
        {
          role: 'assistant',
          content:
            'Assistant is online. I can still help right now. Try commands like: my tasks, my meetings, connect my trello <token>.',
        },
      ]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (!visible || !open) {
      return;
    }
    void loadHistory();
  }, [loadHistory, open, visible]);

  useEffect(() => {
    if (!visible) {
      setOpen(false);
    }
  }, [visible]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) {
      return;
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };

    setMessages((current) => [...current, userMessage]);
    setInput('');
    setSending(true);

    try {
      const response = await fetch('/api/ai-chat/send', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          message: text,
          model: DEFAULT_CHAT_MODEL,
        }),
      });

      const payload = (await response.json()) as ChatSendResponse;
      if (!response.ok || !payload?.success || !payload.reply) {
        throw new Error(payload?.error || 'Assistant request failed.');
      }

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: payload.reply || '',
          created_at: new Date().toISOString(),
        },
      ]);

      if (payload.user_name) {
        setUserName(payload.user_name);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Assistant request failed.';
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: message,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [input, sending]);

  const clearHistory = useCallback(async () => {
    try {
      await fetch('/api/ai-chat/clear', {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      setMessages([]);
    } catch {
      // Ignore clear failures and keep current messages.
    }
  }, []);

  const onInputEnter = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        void sendMessage();
      }
    },
    [sendMessage]
  );

  if (!visible) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="fixed bottom-5 right-5 z-[120] inline-flex h-14 w-14 items-center justify-center rounded-full border border-cyan-200/45 bg-[linear-gradient(135deg,#22d3ee,#60a5fa)] text-black shadow-[0_20px_45px_-20px_rgba(56,189,248,0.9)] transition hover:scale-[1.03]"
        aria-label="Open AI assistant chat"
      >
        <Bot className="h-6 w-6" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.section
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 220, damping: 22 }}
            className="fixed bottom-24 right-5 z-[121] flex h-[70vh] w-[min(420px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-white/20 bg-[linear-gradient(170deg,rgba(20,20,24,0.98),rgba(10,10,12,0.99))] shadow-[0_40px_70px_-35px_rgba(0,0,0,0.95)]"
          >
            <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-cyan-200">AI Personal Assistant</p>
                <p className="mt-1 text-sm text-white/80">Ready to help</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void clearHistory()}
                  className="rounded-md border border-white/20 p-1.5 text-white/75 transition hover:bg-white/10"
                  title="Clear chat"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-white/20 p-1.5 text-white/75 transition hover:bg-white/10"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {loadingHistory ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/80">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  Loading history...
                </div>
              ) : messages.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/70">
                  Ask anything about your tasks, priorities, meetings, and integrations.
                </div>
              ) : (
                messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}-${message.created_at || 'na'}`}
                    className={[
                      'rounded-xl border px-3 py-2.5 text-sm leading-6',
                      message.role === 'user'
                        ? 'ml-8 border-cyan-200/25 bg-cyan-500/10 text-cyan-50'
                        : 'mr-8 border-white/12 bg-white/[0.03] text-white/88',
                    ].join(' ')}
                  >
                    <p>{message.content}</p>
                  </div>
                ))
              )}

              {sending ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/80">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  Thinking...
                </div>
              ) : null}
            </div>

            <div className="border-t border-white/10 px-4 py-3">
              <div className="flex gap-2">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={onInputEnter}
                  rows={2}
                  placeholder="Ask anything..."
                  className="flex-1 resize-none rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm text-white placeholder:text-white/45"
                />
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={!canSend}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white text-black transition hover:bg-zinc-200 disabled:opacity-45"
                >
                  {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <div className="fixed bottom-5 right-5 z-[119] pointer-events-none h-14 w-14 rounded-full bg-cyan-400/35 blur-xl" />
    </>
  );
}
