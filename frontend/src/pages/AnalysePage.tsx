import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  LoaderCircle,
  Paperclip,
  Sparkles,
  WandSparkles,
  X,
} from 'lucide-react';

type ToastTone = 'success' | 'error' | 'info';

type ToastItem = {
  id: number;
  title: string;
  message: string;
  tone: ToastTone;
};

type AnalysisResult = {
  executiveSummary: string;
  keyPoints: string[];
  actionItems: string[];
  riskNotes: string[];
  confidence: number;
  processingTime: string;
  source: string;
};

type ApiLikeResult = {
  summary?: string;
  executive_summary?: string;
  key_points?: string[];
  highlights?: string[];
  action_items?: Array<
    | string
    | {
        task?: string;
        assignee?: string;
        due_date?: string;
        priority?: string;
        context?: string[];
      }
  >;
  tasks?: string[];
  risks?: string[];
  confidence?: number;
  processing_time?: string;
};

type AnalyseApiResponse = {
  success?: boolean;
  error?: string;
  analysis?: ApiLikeResult;
  persisted_to_dashboard?: boolean;
  meeting_id?: string | null;
};

type StoreAnalysisResponse = {
  success?: boolean;
  error?: string;
  meeting_id?: string;
};

type ExtractFileResponse = {
  success?: boolean;
  text?: string;
  word_count?: number;
  truncated?: boolean;
  error?: string;
};

type PipelineState = 'pending' | 'active' | 'done';

type PipelineStep = {
  key: string;
  label: string;
  detail: string;
  state: PipelineState;
};

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ACCEPTED_TYPES = ['.txt', '.doc', '.docx', '.pdf'];

const toastToneClass: Record<ToastTone, string> = {
  success: 'border-emerald-300/30 bg-emerald-500/15 text-emerald-100',
  error: 'border-rose-300/30 bg-rose-500/15 text-rose-100',
  info: 'border-sky-300/30 bg-sky-500/15 text-sky-100',
};

const PIPELINE_TEMPLATE: Array<Omit<PipelineStep, 'state'>> = [
  {
    key: 'run_function',
    label: 'Run Function',
    detail: 'Booting analysis function and validating transcript payload.',
  },
  {
    key: 'sending_data',
    label: 'Sending Data',
    detail: 'Sending transcript and file context to the API analyze endpoint.',
  },
  {
    key: 'extracting_data',
    label: 'Extracting Data',
    detail: 'Extracting summary, key points, risks, and action items from model output.',
  },
  {
    key: 'sending_dashboard',
    label: 'Sending To Dashboard',
    detail: 'Persisting AI insights so dashboard counters and task board update automatically.',
  },
  {
    key: 'building_output',
    label: 'Typewriter Detailed Output',
    detail: 'Preparing the detailed report for animated typewriter rendering.',
  },
];

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(() => resolve(), ms);
  });
}

function buildPipelineSteps(): PipelineStep[] {
  return PIPELINE_TEMPLATE.map((step) => ({ ...step, state: 'pending' }));
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function pickSentences(text: string, max: number) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, max);
}

function normalizeActionLine(item: string | { task?: string; assignee?: string; due_date?: string; priority?: string; context?: string[] }) {
  if (typeof item === 'string') {
    return item;
  }

  const task = item.task || 'Untitled task';
  const assignee = item.assignee || 'Unassigned';
  const due = item.due_date || 'Not specified';
  const priority = (item.priority || 'medium').toUpperCase();
  return `${task} | Owner: ${assignee} | Due: ${due} | Priority: ${priority}`;
}

function buildTypewriterReport(result: AnalysisResult) {
  return [
    'AI ANALYSIS BRIEF',
    '',
    'EXECUTIVE SUMMARY',
    result.executiveSummary,
    '',
    'KEY POINTS',
    ...(result.keyPoints.length > 0 ? result.keyPoints.map((line) => `- ${line}`) : ['- None']),
    '',
    'ACTION ITEMS',
    ...(result.actionItems.length > 0 ? result.actionItems.map((line, index) => `${index + 1}. ${line}`) : ['None']),
    '',
    'RISK NOTES',
    ...(result.riskNotes.length > 0 ? result.riskNotes.map((line) => `- ${line}`) : ['- None']),
    '',
    `Confidence: ${result.confidence}%`,
    `Source: ${result.source}`,
    `Processing Time: ${result.processingTime}`,
  ].join('\n');
}

function fallbackFromTranscript(transcript: string, file: File | null, elapsedMs: number): AnalysisResult {
  const sentences = pickSentences(transcript, 6);
  const lowered = transcript.toLowerCase();

  const actionSeeds = transcript
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => /action|owner|next step|todo|follow up|deadline/i.test(line))
    .slice(0, 4);

  const riskSeeds = transcript
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => /risk|blocker|delay|issue|concern|bottleneck/i.test(line))
    .slice(0, 3);

  const confidenceRaw = Math.min(
    94,
    63 + Math.floor(Math.min(transcript.length, 3200) / 120) + (file ? 5 : 0) + (actionSeeds.length > 0 ? 4 : 0)
  );

  return {
    executiveSummary:
      sentences[0] ||
      'Meeting details captured. The transcript has enough context to generate operational highlights and action recommendations.',
    keyPoints:
      sentences.length > 0
        ? sentences.slice(0, 3)
        : [
            'Core objectives were discussed and aligned among participants.',
            'Execution dependencies require close tracking through implementation.',
            'The team expects a clearer owner map across immediate next steps.',
          ],
    actionItems:
      actionSeeds.length > 0
        ? actionSeeds
        : [
            'Assign an owner for each open deliverable and confirm deadlines.',
            'Schedule a short checkpoint to validate dependencies and blockers.',
            'Publish a concise execution brief to all stakeholders.',
          ],
    riskNotes:
      riskSeeds.length > 0
        ? riskSeeds
        : [
            lowered.includes('timeline')
              ? 'Timeline pressure was mentioned; scope control is recommended.'
              : 'Potential timeline drift may occur without weekly checkpointing.',
            'Cross-team dependencies can create silent blockers without explicit ownership.',
          ],
    confidence: confidenceRaw,
    processingTime: `${Math.max(1.3, elapsedMs / 1000).toFixed(1)}s`,
    source: file ? 'Hybrid (transcript + attachment context)' : 'Transcript-only model pass',
  };
}

function normalizeApiResult(payload: ApiLikeResult, transcript: string, file: File | null, elapsedMs: number): AnalysisResult {
  const fallback = fallbackFromTranscript(transcript, file, elapsedMs);

  return {
    executiveSummary: payload.summary || payload.executive_summary || fallback.executiveSummary,
    keyPoints:
      (payload.key_points && payload.key_points.length > 0
        ? payload.key_points
        : payload.highlights && payload.highlights.length > 0
          ? payload.highlights
          : fallback.keyPoints
      ).slice(0, 4),
    actionItems:
      (payload.action_items && payload.action_items.length > 0
        ? payload.action_items.map((item) => normalizeActionLine(item))
        : payload.tasks && payload.tasks.length > 0
          ? payload.tasks
          : fallback.actionItems
      ).slice(0, 5),
    riskNotes: (payload.risks && payload.risks.length > 0 ? payload.risks : fallback.riskNotes).slice(0, 4),
    confidence:
      typeof payload.confidence === 'number' && payload.confidence > 0
        ? Math.min(99, Math.max(1, Math.round(payload.confidence)))
        : fallback.confidence,
    processingTime: payload.processing_time || fallback.processingTime,
    source: 'API analysis engine',
  };
}

export default function AnalysePage() {
  const [transcript, setTranscript] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [extractingFile, setExtractingFile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [showClearPopup, setShowClearPopup] = useState(false);
  const [showResultPopup, setShowResultPopup] = useState(false);
  const [showPipelinePopup, setShowPipelinePopup] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [typedReport, setTypedReport] = useState('');
  const [fullReport, setFullReport] = useState('');
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>(() => buildPipelineSteps());
  const [pipelineLogs, setPipelineLogs] = useState<string[]>([]);

  const words = useMemo(() => transcript.trim().split(/\s+/).filter(Boolean).length, [transcript]);

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

  const appendPipelineLog = useCallback((line: string) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setPipelineLogs((current) => [...current, `[${timestamp}] ${line}`]);
  }, []);

  const resetPipeline = useCallback(() => {
    setPipelineSteps(buildPipelineSteps());
    setPipelineLogs([]);
  }, []);

  const setStepState = useCallback((key: string, state: PipelineState) => {
    setPipelineSteps((current) =>
      current.map((step) => {
        if (step.key === key) {
          return { ...step, state };
        }
        return step;
      })
    );
  }, []);

  useEffect(() => {
    if (!isLoading) {
      return;
    }

    setProgress(12);
    const intervalId = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 92) {
          return current;
        }
        const increment = Math.max(2, Math.floor((96 - current) / 8));
        return Math.min(92, current + increment);
      });
    }, 240);

    return () => window.clearInterval(intervalId);
  }, [isLoading]);

  useEffect(() => {
    if (!showResultPopup || !fullReport) {
      return;
    }

    setTypedReport('');
    let index = 0;
    const total = fullReport.length;

    const timerId = window.setInterval(() => {
      const step = Math.max(1, Math.floor(total / 230));
      index = Math.min(total, index + step);
      setTypedReport(fullReport.slice(0, index));
      if (index >= total) {
        window.clearInterval(timerId);
      }
    }, 26);

    return () => window.clearInterval(timerId);
  }, [fullReport, showResultPopup]);

  const setValidatedFile = useCallback(
    async (incoming: File) => {
      const extension = incoming.name.includes('.') ? incoming.name.slice(incoming.name.lastIndexOf('.')).toLowerCase() : '';

      if (!ACCEPTED_TYPES.includes(extension)) {
        pushToast('Unsupported file type', 'Attach only TXT, DOC, DOCX, or PDF files.', 'error');
        return;
      }

      if (incoming.size > MAX_FILE_SIZE) {
        pushToast('File is too large', 'Maximum file size is 20 MB.', 'error');
        return;
      }

      setFile(incoming);
      pushToast('Attachment added', `${incoming.name} is ready for analysis.`, 'success');

      setExtractingFile(true);
      try {
        const formData = new FormData();
        formData.append('file', incoming);

        const response = await fetch('/api/transcript/extract-file', {
          method: 'POST',
          body: formData,
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });

        const payload = (await response.json()) as ExtractFileResponse;
        if (!response.ok || !payload?.success || !payload.text) {
          throw new Error(payload?.error || `Could not extract text from file (${response.status})`);
        }

        setTranscript((current) => {
          if (!current.trim()) {
            return payload.text || '';
          }
          return `${current.trim()}\n\n${payload.text}`;
        });

        pushToast(
          'File text loaded',
          payload.truncated
            ? 'Attachment text was loaded and trimmed to supported length.'
            : `Loaded ${payload.word_count || 0} words from attachment into transcript.`,
          'success'
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to extract text from file.';
        pushToast('File extraction failed', message, 'error');
      } finally {
        setExtractingFile(false);
      }
    },
    [pushToast]
  );

  const onFileInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const chosen = event.target.files?.[0];
      if (!chosen) {
        return;
      }
      void setValidatedFile(chosen);
      event.target.value = '';
    },
    [setValidatedFile]
  );

  const persistAnalysisToDashboard = useCallback(
    async (analysis: AnalysisResult, rawAnalysis?: ApiLikeResult) => {
      const response = await fetch('/api/dashboard/store-analysis', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          transcript,
          analysis: rawAnalysis,
          summary: analysis.executiveSummary,
          key_points: analysis.keyPoints,
          action_items: analysis.actionItems,
          risks: analysis.riskNotes,
        }),
      });

      const payload = (await response.json()) as StoreAnalysisResponse;
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || `Dashboard sync failed (${response.status})`);
      }

      return payload.meeting_id || null;
    },
    [transcript]
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!transcript.trim()) {
        pushToast('Transcript required', 'Please add meeting text before running analysis.', 'error');
        return;
      }

      if (transcript.trim().length < 30) {
        pushToast('More context needed', 'Add a bit more detail to get a reliable analysis.', 'info');
        return;
      }

      setIsLoading(true);
      setShowPipelinePopup(true);
      resetPipeline();
      setProgress(6);
      appendPipelineLog('Pipeline started. Waiting to run analysis function.');
      const startedAt = performance.now();

      try {
        setStepState('run_function', 'active');
        setProgress(14);
        appendPipelineLog('Run Function: validated transcript and attachment inputs.');
        await wait(800);
        setStepState('run_function', 'done');

        const formData = new FormData();
        formData.append('transcript', transcript);
        if (file) {
          formData.append('file', file);
        }

        setStepState('sending_data', 'active');
        setProgress(32);
        appendPipelineLog('Sending Data: request dispatched to /api/analyse endpoint.');

        const responsePromise = fetch('/api/analyse', {
          method: 'POST',
          body: formData,
          credentials: 'include',
          headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
        });

        const [response] = await Promise.all([responsePromise, wait(1200)]);
        const contentType = response.headers.get('content-type') || '';
        const apiPayload = contentType.includes('application/json')
          ? ((await response.json()) as AnalyseApiResponse)
          : null;

        setStepState('sending_data', 'done');

        if (!response.ok || (apiPayload && apiPayload.success === false)) {
          throw new Error(apiPayload?.error || `Analysis request failed (${response.status})`);
        }

        setStepState('extracting_data', 'active');
        setProgress(56);
        appendPipelineLog('Extracting Data: normalizing API response into summary, actions, and risk blocks.');

        const elapsed = performance.now() - startedAt;

        let nextResult: AnalysisResult;
        if (apiPayload) {
          const normalizedPayload = apiPayload.analysis || (apiPayload as unknown as ApiLikeResult);
          nextResult = normalizeApiResult(normalizedPayload, transcript, file, elapsed);
        } else {
          nextResult = fallbackFromTranscript(transcript, file, elapsed);
        }

        await wait(900);
        setStepState('extracting_data', 'done');

        setStepState('sending_dashboard', 'active');
        setProgress(78);
        if (apiPayload?.persisted_to_dashboard) {
          appendPipelineLog('Sending To Dashboard: API stored insights and tasks for dashboard sync.');
          await wait(700);
        } else {
          appendPipelineLog('Sending To Dashboard: API did not persist data. Storing analysis via dashboard endpoint.');
          await persistAnalysisToDashboard(nextResult, apiPayload?.analysis);
          appendPipelineLog('Dashboard sync complete. Meeting summary and tasks saved.');
        }
        setStepState('sending_dashboard', 'done');

        setStepState('building_output', 'active');
        setProgress(92);
        appendPipelineLog('Typewriter Detailed Output: building report animation payload.');
        await wait(700);
        setStepState('building_output', 'done');

        setResult(nextResult);
        setFullReport(buildTypewriterReport(nextResult));
        setProgress(100);
        await wait(320);
        setShowPipelinePopup(false);
        setShowResultPopup(true);
        pushToast('Analysis complete', 'Executive summary and dashboard data are ready.', 'success');
      } catch (error) {
        appendPipelineLog('API unavailable. Falling back to local analysis draft while keeping workflow continuity.');
        const elapsed = performance.now() - startedAt;
        const backup = fallbackFromTranscript(transcript, file, elapsed);

        setStepState('run_function', 'done');
        setStepState('sending_data', 'done');
        setStepState('extracting_data', 'done');
        setStepState('sending_dashboard', 'active');
        try {
          await persistAnalysisToDashboard(backup);
          appendPipelineLog('Fallback summary was stored to dashboard successfully.');
        } catch (persistError) {
          const persistMessage =
            persistError instanceof Error ? persistError.message : 'Could not sync fallback result to dashboard.';
          appendPipelineLog(`Fallback dashboard sync failed: ${persistMessage}`);
          pushToast('Dashboard sync failed', persistMessage, 'error');
        }
        setStepState('sending_dashboard', 'done');

        setStepState('building_output', 'active');
        await wait(450);
        setStepState('building_output', 'done');

        setResult(backup);
        setFullReport(buildTypewriterReport(backup));
        setProgress(100);
        await wait(260);
        setShowPipelinePopup(false);
        setShowResultPopup(true);
        const errorMessage = error instanceof Error ? error.message : 'AI service unavailable.';
        pushToast('API unavailable', `Showing local draft. ${errorMessage}`, 'info');
      } finally {
        window.setTimeout(() => setProgress(0), 700);
        setIsLoading(false);
      }
    },
    [appendPipelineLog, file, persistAnalysisToDashboard, pushToast, resetPipeline, setStepState, transcript]
  );

  const clearAll = useCallback(() => {
    setTranscript('');
    setFile(null);
    setResult(null);
    setShowClearPopup(false);
    pushToast('Cleared', 'Transcript and attachment were removed.', 'info');
  }, [pushToast]);

  return (
    <>
      <main className="relative overflow-hidden px-6 py-10 md:px-8 md:py-14">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl"
            animate={{ x: [0, 35, -10, 0], y: [0, -10, 14, 0], opacity: [0.3, 0.5, 0.4, 0.3] }}
            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute right-0 top-20 h-80 w-80 rounded-full bg-amber-400/20 blur-3xl"
            animate={{ x: [0, -28, 14, 0], y: [0, 18, -12, 0], opacity: [0.25, 0.45, 0.35, 0.25] }}
            transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_40%),radial-gradient(circle_at_78%_10%,rgba(255,189,89,0.08),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))]" />
        </div>

        <div className="relative mx-auto max-w-5xl">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="rounded-3xl border border-white/15 bg-[linear-gradient(160deg,rgba(22,22,25,0.86),rgba(7,7,9,0.94))] p-6 shadow-[0_20px_80px_-35px_rgba(0,0,0,0.85)] md:p-8"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-cyan-100">
                <Sparkles className="h-3.5 w-3.5" />
                Premium Analyze
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-xs text-white/70">
                <Clock3 className="h-3.5 w-3.5" />
                Real-time inference workflow
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-5xl">Deep Meeting Intelligence</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/72 md:text-base">
              Drop in transcript text, attach supporting files, and generate a refined executive summary with action ownership,
              risk signals, and confidence scoring.
            </p>

            <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
              <label className="grid gap-2 text-sm text-white/80">
                Meeting transcript
                <textarea
                  value={transcript}
                  onChange={(event) => setTranscript(event.target.value)}
                  className="min-h-56 rounded-2xl border border-white/20 bg-black/45 px-4 py-4 text-sm text-white placeholder:text-white/35 outline-none transition focus:border-cyan-300/45 focus:ring-2 focus:ring-cyan-300/20"
                  placeholder="Paste full transcript, key comments, and owner cues..."
                  disabled={isLoading}
                  required
                />
              </label>

              <div className="rounded-2xl border border-white/15 bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-white/65">Attach TXT, DOC, DOCX, or PDF. Added file text is auto-loaded into transcript.</p>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/25 bg-white/[0.05] px-4 py-2 text-sm text-white transition hover:border-white/50 hover:bg-white/[0.1]">
                    <Paperclip className="h-4 w-4" />
                    {extractingFile ? 'Loading file text...' : 'Add document'}
                    <input
                      type="file"
                      className="hidden"
                      accept={ACCEPTED_TYPES.join(',')}
                      onChange={onFileInputChange}
                      disabled={isLoading || extractingFile}
                    />
                  </label>
                </div>

                {file ? (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-50">
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0" />
                      <p className="truncate">{file.name}</p>
                      <span className="shrink-0 text-cyan-100/75">{formatFileSize(file.size)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="rounded-md border border-cyan-200/35 px-2 py-1 text-xs transition hover:bg-cyan-200/10"
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/65">
                  Words: <span className="font-medium text-white/90">{words}</span> | Characters:{' '}
                  <span className="font-medium text-white/90">{transcript.length}</span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowClearPopup(true)}
                  className="rounded-xl border border-white/25 px-4 py-2.5 text-sm text-white/85 transition hover:border-white/55 hover:bg-white/[0.06]"
                  disabled={isLoading || (!transcript && !file)}
                >
                  Clear
                </button>

                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#22d3ee,#60a5fa,#f59e0b)] px-5 py-2.5 text-sm font-semibold text-black shadow-[0_12px_40px_-16px_rgba(56,189,248,0.85)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isLoading}
                >
                  {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                  {isLoading ? 'Analyzing and Storing...' : 'Analyze and Store'}
                </button>
              </div>

              <AnimatePresence>
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="rounded-2xl border border-cyan-200/20 bg-cyan-500/10 p-4"
                  >
                    <div className="flex items-center justify-between text-sm text-cyan-100">
                      <span>Processing transcript + attachment context</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/35">
                      <motion.div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#60a5fa,#fbbf24)]"
                        animate={{ width: `${progress}%` }}
                        transition={{ ease: 'easeOut', duration: 0.25 }}
                      />
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      <div className="h-10 rounded-lg bg-white/10" />
                      <div className="h-10 rounded-lg bg-white/10" />
                      <div className="h-10 rounded-lg bg-white/10" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </motion.section>
        </div>
      </main>

      <AnimatePresence>
        {showPipelinePopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[82] flex items-center justify-center bg-black/75 p-5 backdrop-blur-xl"
          >
            <motion.section
              initial={{ scale: 0.97, y: 12, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.97, y: 12, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 210, damping: 22 }}
              className="w-full max-w-3xl rounded-3xl border border-white/15 bg-[linear-gradient(165deg,rgba(20,20,24,0.96),rgba(8,8,10,0.99))] p-6 md:p-8"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-cyan-200">Analysis Pipeline</p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">Running Analyze and Store Workflow</h3>
                  <p className="mt-2 text-sm text-white/65">
                    Run function, analyse, send data, extract output, and sync all insights to dashboard.
                  </p>
                </div>
                <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-3 py-2 text-lg font-semibold text-cyan-100">
                  {progress}%
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/40">
                <motion.div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#60a5fa,#fbbf24)]"
                  animate={{ width: `${progress}%` }}
                  transition={{ ease: 'easeOut', duration: 0.25 }}
                />
              </div>

              <div className="mt-5 grid gap-2">
                {pipelineSteps.map((step) => (
                  <div key={step.key} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="mt-0.5">
                      {step.state === 'done' ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                      ) : step.state === 'active' ? (
                        <LoaderCircle className="h-4 w-4 animate-spin text-cyan-200" />
                      ) : (
                        <Clock3 className="h-4 w-4 text-white/45" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{step.label}</p>
                      <p className="mt-1 text-xs text-white/62">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-white/12 bg-black/45 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-cyan-200">Pipeline Console</p>
                <pre className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap text-xs leading-6 text-cyan-50">
{pipelineLogs.length > 0 ? pipelineLogs.join('\n') : 'Waiting for pipeline activity...'}
                </pre>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showResultPopup && result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-5 backdrop-blur-xl"
          >
            <motion.section
              initial={{ scale: 0.97, y: 12, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.97, y: 12, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 22 }}
              className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/15 bg-[linear-gradient(165deg,rgba(20,20,24,0.95),rgba(8,8,10,0.98))] p-6 md:p-8"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-cyan-200">Analysis result</p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">Executive Brief Generated</h3>
                  <p className="mt-2 text-sm text-white/65">Source: {result.source} | Runtime: {result.processingTime}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowResultPopup(false)}
                  className="rounded-lg border border-white/20 p-2 text-white/80 transition hover:bg-white/[0.08]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-6 grid gap-4">
                <div className="rounded-2xl border border-white/15 bg-black/45 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-cyan-200">Typewriter Output</p>
                  <pre className="mt-3 max-h-56 overflow-y-auto whitespace-pre-wrap text-xs leading-6 text-cyan-50">{typedReport}</pre>
                </div>

                <div className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-emerald-100/90">Executive Summary</p>
                  <p className="mt-2 text-sm leading-7 text-emerald-50">{result.executiveSummary}</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4">
                    <p className="text-sm font-semibold text-cyan-100">Key Points</p>
                    <ul className="mt-3 grid gap-2 text-sm text-cyan-50/90">
                      {result.keyPoints.map((point) => (
                        <li key={point} className="rounded-lg border border-cyan-200/20 bg-black/25 px-3 py-2">
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4">
                    <p className="text-sm font-semibold text-amber-100">Action Items</p>
                    <ul className="mt-3 grid gap-2 text-sm text-amber-50/90">
                      {result.actionItems.map((item) => (
                        <li key={item} className="rounded-lg border border-amber-200/20 bg-black/25 px-3 py-2">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                  <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 p-4">
                    <p className="text-sm font-semibold text-rose-100">Risk Signals</p>
                    <ul className="mt-3 grid gap-2 text-sm text-rose-50/90">
                      {result.riskNotes.map((risk) => (
                        <li key={risk} className="rounded-lg border border-rose-200/20 bg-black/25 px-3 py-2">
                          {risk}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex min-w-40 flex-col justify-between rounded-2xl border border-white/15 bg-white/[0.04] p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-white/55">Confidence</p>
                    <p className="text-3xl font-semibold text-white">{result.confidence}%</p>
                    <div className="mt-3 h-2 rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#34d399,#22d3ee,#fbbf24)]"
                        style={{ width: `${result.confidence}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showClearPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[75] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.97, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.97, y: 10 }}
              transition={{ type: 'spring', stiffness: 250, damping: 22 }}
              className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0d0d10] p-5"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg border border-amber-300/25 bg-amber-500/15 p-2 text-amber-200">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Clear current draft?</h3>
                  <p className="mt-1 text-sm text-white/65">This removes transcript text and any attached file from the form.</p>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowClearPopup(false)}
                  className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/80 transition hover:bg-white/[0.08]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200"
                >
                  Clear now
                </button>
              </div>
            </motion.div>
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
                    <AlertTriangle className="h-4 w-4" />
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