"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Bot,
  CheckCircle2,
  Code2,
  Cpu,
  Database,
  FileText,
  Gauge,
  KeyRound,
  Link2,
  ListChecks,
  Lock,
  Network,
  Rocket,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
  UserCheck,
  Workflow,
} from "lucide-react";

type DocCategory = {
  id: string;
  label: string;
  summary: string;
  icon: ComponentType<{ className?: string }>;
};

type DocSnippet = {
  title: string;
  code: string;
};

type EndpointSpec = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  description: string;
  auth: "public" | "protected";
};

type DocSection = {
  id: string;
  category: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  summary: string;
  highlights: string[];
  checklist?: string[];
  commands?: string[];
  snippets?: DocSnippet[];
  endpoints?: EndpointSpec[];
};

const categories: DocCategory[] = [
  {
    id: "foundation",
    label: "Foundation",
    summary: "Core product understanding and setup path.",
    icon: BookOpen,
  },
  {
    id: "workflows",
    label: "Workflows",
    summary: "Auth, analysis, and integration behavior.",
    icon: Workflow,
  },
  {
    id: "platform",
    label: "Platform",
    summary: "Models, data, security, and environment policy.",
    icon: Server,
  },
  {
    id: "reference",
    label: "API Reference",
    summary: "Operational endpoint map and payload contracts.",
    icon: Code2,
  },
  {
    id: "operations",
    label: "Operations",
    summary: "Troubleshooting, release checks, ownership, and delivery.",
    icon: Activity,
  },
];

const teamMembers = [
  { name: "Hamza Sayyad", role: "Frontend Developer" },
  { name: "Hasan Shaikh", role: "AI Engineer" },
  { name: "Ujjval Shrivastav", role: "Backend Developer" },
  { name: "Rahul Rathod", role: "Cloud & Database" },
];

const sections: DocSection[] = [
  {
    id: "platform-overview",
    category: "foundation",
    icon: Sparkles,
    title: "Platform Overview",
    summary: "What the AI Meeting Agent solves and how teams consume outputs.",
    highlights: [
      "Converts transcript text into structured execution artifacts: summary, decisions, actions, risks, and delivery order.",
      "Bridges meeting notes to work systems so teams move from discussion to implementation faster.",
      "Keeps one source of truth across product, engineering, and operations users.",
      "Supports both manual review and integration-driven automation for task creation.",
      "Designed for repeatable delivery cycles where visibility and speed both matter.",
      "Built for production usage with auth gates, persistence, and fallback safety around model calls.",
    ],
    checklist: [
      "Use transcript text with clear speaker context when possible.",
      "Confirm decisions and action items before creating external tickets.",
      "Use dashboard history to avoid duplicate execution after re-analysis.",
    ],
  },
  {
    id: "personas-and-value",
    category: "foundation",
    icon: UserCheck,
    title: "User Personas",
    summary: "Who uses this platform and what each role gets.",
    highlights: [
      "Engineering leads: execution readiness, ownership clarity, and risk scan.",
      "Product managers: concise decision map, backlog candidates, and timeline direction.",
      "Developers: actionable tasks with priority hints and integration-ready output.",
      "Operations: stable auth/API behavior, observability focus, and release confidence.",
      "All personas read the same factual meeting intelligence with role-specific emphasis.",
    ],
  },
  {
    id: "quickstart",
    category: "foundation",
    icon: Rocket,
    title: "Quick Start",
    summary: "Local setup path for backend + frontend with correct order and checks.",
    highlights: [
      "Run backend first so auth, analysis, and integration APIs are available.",
      "Run frontend second so route guards and UI flows can call backend endpoints.",
      "Development assumes Vite on 5173 and Flask on 5001.",
      "Both services should stay running during feature validation.",
    ],
    commands: [
      "cd /Users/adnan/Downloads/hamza-meeting",
      "python run.py",
      "cd /Users/adnan/Downloads/hamza-meeting/frontend",
      "npm install",
      "npm run dev",
      "npm run build",
    ],
    snippets: [
      {
        title: "Expected local URLs",
        code: "Frontend: http://localhost:5173\nBackend: http://localhost:5001",
      },
    ],
    checklist: [
      "Confirm backend boots without database/auth errors.",
      "Confirm /api/auth/status returns JSON.",
      "Confirm docs, login, dashboard routes load without runtime exceptions.",
    ],
  },
  {
    id: "architecture",
    category: "foundation",
    icon: Workflow,
    title: "Architecture",
    summary: "Frontend, backend, AI, and persistence boundaries.",
    highlights: [
      "Frontend stack: React + Vite + TypeScript + Tailwind utility styling.",
      "Backend stack: Flask routes for auth, transcript analysis, and integrations.",
      "AI pipeline: Gemini flash-family model selection with fallback sequence.",
      "Data layer stores users, insights, action items, and integration credentials.",
      "Route guards rely on /api/auth/status so protected routes are never leaked.",
      "Flask serves API responsibilities while frontend handles UI routing and state.",
    ],
    snippets: [
      {
        title: "Main responsibilities",
        code: "frontend/src/App.tsx -> routing + auth guards\nfrontend/components/ui -> reusable UI modules\nmain_app.py -> auth, analysis, persistence, integrations",
      },
    ],
  },
  {
    id: "auth-and-routes",
    category: "workflows",
    icon: Lock,
    title: "Authentication And Route Policy",
    summary: "Auth lifecycle and public/protected route behavior.",
    highlights: [
      "Registration validates identity data and sends email verification flow.",
      "Login state is enforced in UI through dedicated route guards.",
      "Public routes include home, auth screens, and docs.",
      "Protected routes include dashboard, analysis, integrations, and team.",
      "Alias support keeps both /analyse and /analyze operational.",
      "Reset password aliases reduce breakage for historic links.",
    ],
    snippets: [
      {
        title: "Auth status envelope",
        code: "{\n  \"success\": true,\n  \"authenticated\": false,\n  \"user\": null\n}",
      },
      {
        title: "Route policy",
        code: "Unauthenticated -> redirect /login\nAuthenticated -> allow /dashboard /analyse /integrations /team",
      },
    ],
    checklist: [
      "Verify register, login, logout, forgot password, and verification paths.",
      "Verify protected routes never render before auth check resolves.",
      "Verify direct URL entry for /dashboard redirects guests.",
    ],
  },
  {
    id: "transcript-analysis",
    category: "workflows",
    icon: Gauge,
    title: "Transcript Analysis Workflow",
    summary: "How raw conversation turns into structured, actionable output.",
    highlights: [
      "Accepts transcript text and optional document upload in one request.",
      "Applies extraction and validation before model prompt generation.",
      "Requests strict JSON output to reduce post-processing ambiguity.",
      "Normalizes priorities, due date hints, and ownership context.",
      "Stores outputs for dashboard continuity and later review.",
      "Includes automation messages when Jira/Trello creation is requested.",
    ],
    snippets: [
      {
        title: "Structured analysis keys",
        code: "summary\ndecisions[]\ntopics[]\naction_items[]\nai_insight[]\nsuggested_execution_order[]\nrisks[]",
      },
      {
        title: "Analyse request form fields",
        code: "transcript: string\nfile: optional upload\ncreate_trello_cards: boolean\ncreate_jira_tickets: boolean",
      },
    ],
    checklist: [
      "Validate upload type and size before production rollout.",
      "Run both text-only and text+file scenarios.",
      "Verify analysis persistence after browser refresh.",
    ],
  },
  {
    id: "integrations",
    category: "workflows",
    icon: ListChecks,
    title: "Integrations Workflow",
    summary: "Trello and Jira connection behavior plus execution handoff.",
    highlights: [
      "Trello token flow supports card creation from action items.",
      "Jira token flow supports issue creation with project context.",
      "Connection status is available via a dedicated endpoint.",
      "All integration routes are account-scoped and auth-protected.",
      "Automation can be toggled per analysis request.",
      "Failures return actionable error messages rather than silent fallback.",
    ],
    checklist: [
      "Connect at least one Trello account and test card creation.",
      "Connect at least one Jira account and test issue creation.",
      "Disconnect/reconnect to verify credential rotation behavior.",
    ],
  },
  {
    id: "model-strategy",
    category: "platform",
    icon: Cpu,
    title: "AI Model Strategy",
    summary: "Model selection, failover chain, and reliability policy.",
    highlights: [
      "Configured model family includes gemini-2.0-flash, gemini-2.5-flash, and gemini-3-flash.",
      "Primary analysis model can be configured with GEMINI_ANALYSIS_MODEL.",
      "Fallback sequence avoids total failure from single-model outage.",
      "Model metadata is useful for debugging quality drift over time.",
      "All model secrets stay server-side only.",
      "Error payloads should remain explicit when fallback chain exhausts.",
    ],
    checklist: [
      "Verify env vars point to valid model IDs.",
      "Test behavior with a forced invalid model to confirm fallback.",
      "Track latency vs quality before model changes in production.",
    ],
  },
  {
    id: "environment-config",
    category: "platform",
    icon: KeyRound,
    title: "Environment Configuration",
    summary: "Required and optional variables with practical impact.",
    highlights: [
      "Core runtime: DATABASE_URL or POSTGRES_URL, GEMINI_API_KEY, FLASK_SECRET_KEY.",
      "Model routing: GEMINI_MODEL_20, GEMINI_MODEL_25, GEMINI_MODEL_3, GEMINI_ANALYSIS_MODEL.",
      "Email stack: GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN.",
      "Integrations: TRELLO_API_KEY, TRELLO_API_SECRET, Jira credentials per user connection.",
      "VITE_BACKEND_URL supports non-default backend host in local setups.",
      "Missing optional envs should degrade gracefully without blocking core flows.",
    ],
    snippets: [
      {
        title: "Minimal critical environment",
        code: "DATABASE_URL=...\nFLASK_SECRET_KEY=...\nGEMINI_API_KEY=...",
      },
    ],
  },
  {
    id: "data-security",
    category: "platform",
    icon: ShieldCheck,
    title: "Data And Security",
    summary: "Persistence model, access control, and sensitive data handling.",
    highlights: [
      "Session auth uses Flask-Login with protected route decorators.",
      "Data access is scoped by user identity for private records.",
      "Stored entities include users, insights, tasks, credentials, and chat history.",
      "Sensitive values are never exposed in frontend code.",
      "Chat and integration payloads should avoid raw secret logging.",
      "Security posture depends on strict server-only token usage.",
    ],
    snippets: [
      {
        title: "Primary persistence entities",
        code: "Users\nMeetingInsight\nWorkActionItem\nTrelloCredentials\nJiraCredentials\nChatMessage",
      },
    ],
  },
  {
    id: "network-proxy",
    category: "platform",
    icon: Network,
    title: "Networking And Proxy",
    summary: "Dev networking expectations and proxy behavior.",
    highlights: [
      "Frontend runs on 5173 and backend on 5001 in local development.",
      "Vite proxy keeps API calls same-origin style from browser perspective.",
      "Without proxy, auth and username checks may receive HTML instead of JSON.",
      "Keep SPA routes client-side while API routes target backend handlers.",
      "Proxy consistency is critical for session-cookie behavior.",
    ],
    checklist: [
      "Verify /api/auth/status returns JSON from frontend context.",
      "Verify /check_username returns machine-readable JSON.",
      "Verify /analyse UI route is not accidentally proxied to backend HTML.",
    ],
  },
  {
    id: "api-endpoints",
    category: "reference",
    icon: Link2,
    title: "API Endpoint Reference",
    summary: "Most-used contracts for auth, analysis, integrations, and chat.",
    highlights: [
      "This section is intended for frontend integration and QA validation.",
      "Auth status endpoint is the central source for route guards.",
      "Analysis endpoint supports alias compatibility and automation flags.",
      "Integrations endpoint exposes connection health for UI badges.",
      "Chat endpoint supports AI interactions with model metadata.",
    ],
    endpoints: [
      {
        method: "GET",
        path: "/api/auth/status",
        description: "Returns current authentication state for route guards.",
        auth: "public",
      },
      {
        method: "POST",
        path: "/check_username",
        description: "Checks username availability during registration.",
        auth: "public",
      },
      {
        method: "POST",
        path: "/register",
        description: "Creates account and starts email verification flow.",
        auth: "public",
      },
      {
        method: "POST",
        path: "/login",
        description: "Authenticates user and initializes session.",
        auth: "public",
      },
      {
        method: "GET",
        path: "/logout",
        description: "Terminates authenticated session.",
        auth: "protected",
      },
      {
        method: "POST",
        path: "/analyse",
        description: "Runs transcript analysis and optional automation.",
        auth: "protected",
      },
      {
        method: "POST",
        path: "/analyze",
        description: "Alias of /analyse for compatibility.",
        auth: "protected",
      },
      {
        method: "POST",
        path: "/api/transcript/extract-file",
        description: "Extracts text from supported upload formats.",
        auth: "protected",
      },
      {
        method: "GET",
        path: "/api/integrations/status",
        description: "Returns Trello and Jira connection state.",
        auth: "protected",
      },
      {
        method: "POST",
        path: "/api/ai-chat/send",
        description: "Sends chat prompt and returns model response.",
        auth: "protected",
      },
    ],
    snippets: [
      {
        title: "Analyse success envelope",
        code: "{\n  \"success\": true,\n  \"analysis\": { ... },\n  \"automation_messages\": []\n}",
      },
    ],
  },
  {
    id: "uploads-and-format",
    category: "reference",
    icon: FileText,
    title: "Uploads And Content Rules",
    summary: "Accepted formats, extraction behavior, and request quality guardrails.",
    highlights: [
      "Accepted extensions: TXT, DOC, DOCX, PDF.",
      "Server validates file type and size before extraction.",
      "If both text and file are provided, extracted text merges with typed transcript.",
      "Word-count protection improves model reliability and cost control.",
      "Use clear language and meaningful segmentation for better action-item quality.",
    ],
    checklist: [
      "Reject unsupported extension paths.",
      "Reject oversized files with clear user feedback.",
      "Validate mixed input handling for text + file submission.",
    ],
  },
  {
    id: "troubleshooting",
    category: "operations",
    icon: AlertTriangle,
    title: "Troubleshooting",
    summary: "High-frequency local issues and direct fixes.",
    highlights: [
      "If username availability fails in dev, verify Vite proxy target and backend availability.",
      "If protected pages bounce unexpectedly, inspect /api/auth/status payload and cookie behavior.",
      "If analysis fails, verify GEMINI_API_KEY and configured model IDs.",
      "If upload fails, inspect extension and size limits first.",
      "If integrations fail, re-check token validity and scope configuration.",
      "If docs or auth pages blank out, inspect browser console and Vite terminal logs.",
    ],
    checklist: [
      "Reproduce with clean session before deep debugging.",
      "Capture endpoint status codes for each failing action.",
      "Confirm environment variables are loaded in running process.",
    ],
  },
  {
    id: "release-and-deploy",
    category: "operations",
    icon: Terminal,
    title: "Release And Deployment",
    summary: "Pre-release checks and production readiness sequence.",
    highlights: [
      "Build frontend and confirm type safety and route integrity.",
      "Validate auth lifecycle end-to-end before release.",
      "Validate analysis flow for text-only and upload scenarios.",
      "Validate integration status and at least one ticket/card execution path.",
      "Ensure HTTPS and secure cookie settings in production.",
      "Monitor logs for auth, model, and integration failures after deploy.",
    ],
    commands: [
      "cd /Users/adnan/Downloads/hamza-meeting/frontend",
      "npm run build",
      "cd /Users/adnan/Downloads/hamza-meeting",
      "python run.py",
    ],
    checklist: [
      "Run full auth verification in a fresh browser session.",
      "Run analysis with automation flags off and on.",
      "Confirm SPA fallback behavior does not intercept API routes.",
    ],
  },
  {
    id: "service-readiness",
    category: "operations",
    icon: CheckCircle2,
    title: "Service Readiness",
    summary: "Operational health checks before testing or demo.",
    highlights: [
      "Backend starts without persistent database connection errors.",
      "Auth status endpoint responds with valid JSON payload.",
      "Frontend routes render without runtime exceptions.",
      "Analysis endpoint responds with structured payload shape.",
      "Integration status endpoint returns expected connected/disconnected fields.",
    ],
    checklist: [
      "Run smoke checks for public routes.",
      "Run smoke checks for protected routes using authenticated account.",
      "Run one transcript analysis and verify dashboard visibility.",
    ],
  },
  {
    id: "ownership",
    category: "operations",
    icon: Bot,
    title: "Ownership",
    summary: "Primary implementation ownership for this documentation scope.",
    highlights: [
      "Frontend ownership: UI quality, responsiveness, route behavior, and docs presentation.",
      "AI ownership: transcript prompt quality, model behavior, and output consistency.",
      "Backend ownership: API correctness, auth policy, and persistence consistency.",
      "Cloud and database ownership: environment reliability, deployment safety, and data integrity.",
    ],
  },
];

const methodTone: Record<EndpointSpec["method"], string> = {
  GET: "border-sky-300/45 bg-sky-500/15 text-sky-100",
  POST: "border-emerald-300/45 bg-emerald-500/15 text-emerald-100",
  PUT: "border-amber-300/45 bg-amber-500/15 text-amber-100",
  PATCH: "border-violet-300/45 bg-violet-500/15 text-violet-100",
  DELETE: "border-rose-300/45 bg-rose-500/15 text-rose-100",
};

export default function DocumentationHub() {
  const [activeCategory, setActiveCategory] = useState<string>(categories[0].id);
  const [activeId, setActiveId] = useState<string>(sections[0].id);

  const sectionsInCategory = useMemo(
    () => sections.filter((section) => section.category === activeCategory),
    [activeCategory]
  );

  useEffect(() => {
    if (!sectionsInCategory.some((section) => section.id === activeId)) {
      setActiveId(sectionsInCategory[0]?.id || sections[0].id);
    }
  }, [activeId, sectionsInCategory]);

  const activeSection = useMemo(
    () => sections.find((section) => section.id === activeId) || sectionsInCategory[0] || sections[0],
    [activeId, sectionsInCategory]
  );

  const counts = useMemo(
    () => ({
      categories: categories.length,
      sections: sections.length,
      endpoints: sections.reduce((total, section) => total + (section.endpoints?.length || 0), 0),
      checks: sections.reduce((total, section) => total + (section.checklist?.length || 0), 0),
    }),
    []
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
      <header className="rounded-3xl border border-white/15 bg-[radial-gradient(120%_150%_at_0%_0%,rgba(255,255,255,0.16),transparent_45%),linear-gradient(170deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5 sm:p-7 lg:p-8">
        <p className="text-[11px] uppercase tracking-[0.22em] text-white/65">Documentation Hub</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">AI Meeting Agent Docs</h1>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-white/78 sm:text-[15px]">
          Clean, detailed, and production-focused documentation for setup, architecture, auth,
          transcript analysis, integrations, API contracts, and deployment behavior.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-white/12 bg-black/35 px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Tabs</p>
            <p className="mt-1 text-2xl font-semibold text-white">{counts.categories}</p>
          </div>
          <div className="rounded-2xl border border-white/12 bg-black/35 px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Sections</p>
            <p className="mt-1 text-2xl font-semibold text-white">{counts.sections}</p>
          </div>
          <div className="rounded-2xl border border-white/12 bg-black/35 px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Endpoints</p>
            <p className="mt-1 text-2xl font-semibold text-white">{counts.endpoints}</p>
          </div>
          <div className="rounded-2xl border border-white/12 bg-black/35 px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Checks</p>
            <p className="mt-1 text-2xl font-semibold text-white">{counts.checks}</p>
          </div>
        </div>
      </header>

      <section className="mt-5 rounded-3xl border border-white/12 bg-white/[0.03] p-3 sm:p-4">
        <p className="mb-2 px-1 text-[11px] uppercase tracking-[0.2em] text-white/55">Category Tabs</p>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {categories.map((category) => {
            const active = category.id === activeCategory;
            const Icon = category.icon;

            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id)}
                className={`rounded-2xl border px-3 py-3 text-left transition ${
                  active
                    ? "border-white/45 bg-white/[0.12]"
                    : "border-white/12 bg-black/40 hover:border-white/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-white/80" />
                  <p className="text-sm font-semibold text-white">{category.label}</p>
                </div>
                <p className="mt-1 text-xs leading-5 text-white/65">{category.summary}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[290px_1fr]">
        <aside className="rounded-3xl border border-white/12 bg-white/[0.03] p-3 sm:p-4">
          <p className="mb-2 px-1 text-[11px] uppercase tracking-[0.2em] text-white/55">Section Tabs</p>
          <div className="grid gap-2">
            {sectionsInCategory.map((section) => {
              const active = section.id === activeSection.id;
              const Icon = section.icon;

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveId(section.id)}
                  className={`rounded-xl border px-3 py-3 text-left transition ${
                    active
                      ? "border-white/50 bg-white/[0.11]"
                      : "border-white/12 bg-black/35 hover:border-white/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-white/80" />
                    <p className="text-sm font-medium text-white">{section.title}</p>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-white/65">{section.summary}</p>
                </button>
              );
            })}
          </div>
        </aside>

        <article className="rounded-3xl border border-white/12 bg-white/[0.03] p-4 sm:p-6 lg:p-7">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-black/35">
              <activeSection.icon className="h-5 w-5 text-white/85" />
            </span>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{activeSection.title}</h2>
              <p className="mt-1 text-sm leading-7 text-white/72 sm:text-[15px]">{activeSection.summary}</p>
            </div>
          </div>

          <section className="mt-5">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Details</p>
            <div className="mt-2 grid gap-2">
              {activeSection.highlights.map((point, index) => (
                <p
                  key={`${activeSection.id}-point-${index}`}
                  className="rounded-xl border border-white/12 bg-black/35 px-3 py-3 text-sm leading-7 text-white/84"
                >
                  {point}
                </p>
              ))}
            </div>
          </section>

          {activeSection.checklist && activeSection.checklist.length > 0 ? (
            <section className="mt-5">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Validation Checklist</p>
              <div className="mt-2 grid gap-2">
                {activeSection.checklist.map((item, index) => (
                  <div
                    key={`${activeSection.id}-check-${index}`}
                    className="rounded-xl border border-emerald-300/22 bg-emerald-500/10 px-3 py-3 text-sm leading-7 text-emerald-50"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {activeSection.snippets && activeSection.snippets.length > 0 ? (
            <section className="mt-5">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Snippets</p>
              <div className="mt-2 grid gap-2">
                {activeSection.snippets.map((snippet) => (
                  <div key={snippet.title} className="rounded-xl border border-white/14 bg-black/80 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/60">{snippet.title}</p>
                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-sm leading-7 text-zinc-200">
                      {snippet.code}
                    </pre>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {activeSection.commands && activeSection.commands.length > 0 ? (
            <section className="mt-5 rounded-xl border border-white/15 bg-black p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Commands</p>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-sm leading-7 text-emerald-200">
                {activeSection.commands.map((command) => `$ ${command}`).join("\n")}
              </pre>
            </section>
          ) : null}

          {activeSection.endpoints && activeSection.endpoints.length > 0 ? (
            <section className="mt-5">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Endpoint Contracts</p>
              <div className="mt-2 grid gap-2">
                {activeSection.endpoints.map((endpoint) => (
                  <div
                    key={`${endpoint.method}-${endpoint.path}`}
                    className="rounded-xl border border-white/12 bg-black/35 px-3 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${methodTone[endpoint.method]}`}
                      >
                        {endpoint.method}
                      </span>
                      <span className="rounded-full border border-white/18 bg-black/40 px-2 py-1 text-[11px] text-white/72">
                        {endpoint.auth}
                      </span>
                      <code className="text-xs text-zinc-100 sm:text-sm">{endpoint.path}</code>
                    </div>
                    <p className="mt-2 text-sm leading-7 text-white/80">{endpoint.description}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-5 rounded-xl border border-white/12 bg-black/30 px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Operational Note</p>
            <p className="mt-2 text-sm leading-7 text-white/74">
              Keep backend and frontend running together for complete behavior. Route guards,
              status checks, analysis, integrations, and docs verification all depend on live API responses.
            </p>
          </section>
        </article>
      </section>

      <section className="mt-5 rounded-3xl border border-white/12 bg-white/[0.03] p-4 sm:p-6">
        <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">Team Credits</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {teamMembers.map((member) => (
            <div key={member.name} className="rounded-xl border border-white/15 bg-black/35 px-3 py-3">
              <p className="text-sm font-semibold text-white">{member.name}</p>
              <p className="mt-1 text-xs text-white/65">{member.role}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-white/72">L.R. Tiwari College of Engineering</p>
        <p className="mt-1 text-sm text-white/50">© 2026 AI Meeting Agent</p>
      </section>
    </main>
  );
}