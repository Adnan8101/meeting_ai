"use client";

import { useMemo, useState } from "react";
import type { ComponentType } from "react";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Bug,
  CheckCircle2,
  Code2,
  Cpu,
  Database,
  FileText,
  Gauge,
  Globe,
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

type DocSection = {
  id: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  summary: string;
  content: string[];
  commands?: string[];
  snippets?: { title: string; code: string }[];
};

const sections: DocSection[] = [
  {
    id: "overview",
    icon: BookOpen,
    title: "Platform Overview",
    summary: "What AI Meeting Agent does and how teams use it.",
    content: [
      "AI Meeting Agent converts transcript discussions into execution-ready outputs.",
      "The product analyzes meetings, extracts decisions and action items, and keeps progress visible from planning to release.",
      "Teams can review priorities inside the dashboard, then optionally execute through integrations like Trello and Jira.",
      "The platform is designed for practical delivery workflows where speed and traceability both matter.",
      "The UI layer focuses on clarity-first execution so teams can move from note-taking to task delivery with minimal context switching.",
    ],
  },
  {
    id: "personas",
    icon: UserCheck,
    title: "Primary Users",
    summary: "Who uses the platform and what each persona needs.",
    content: [
      "Engineering Leads: need summary quality, task ownership, and release risk visibility.",
      "Product Managers: need decisions, priorities, and execution confidence after meetings.",
      "Developers: need concrete action items with deadlines and integration sync to delivery tools.",
      "Operations/Admin: need environment stability, access control, and observability for issues.",
      "Each persona views the same meeting truth but consumes different slices of the same structured output.",
    ],
  },
  {
    id: "quickstart",
    icon: Rocket,
    title: "Quick Start",
    summary: "Run backend and frontend correctly in local development.",
    content: [
      "Start backend first so auth and analysis endpoints are reachable.",
      "Start frontend second to work on the React UI and route flow.",
      "For full product behavior, both services must run together.",
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
        title: "Expected local ports",
        code: "Frontend: http://localhost:5173\nBackend: http://localhost:5001",
      },
    ],
  },
  {
    id: "service-readiness",
    icon: Activity,
    title: "Service Readiness",
    summary: "Minimum checks before feature validation.",
    content: [
      "Confirm backend starts without MongoDB connection errors.",
      "Confirm /api/auth/status returns JSON with authenticated=false when logged out.",
      "Confirm Vite dev server proxy forwards auth and /check_username requests.",
      "Confirm login/register pages submit correctly and redirect behavior is expected.",
      "Confirm transcript submission reaches /analyse (or /analyze) and receives analysis payload.",
    ],
  },
  {
    id: "architecture",
    icon: Workflow,
    title: "Architecture",
    summary: "How frontend, backend, AI, and database work together.",
    content: [
      "Frontend: React + Vite + TypeScript + Tailwind + shadcn-style components.",
      "Backend: Flask app with authentication, analysis pipeline, and integration endpoints.",
      "AI: Gemini flash-family fallback chain for robust generation.",
      "Database: MongoDB stores users, meeting insights, action items, and integration credentials.",
      "Routing model: React handles UI pages, Flask handles APIs and auth/session logic.",
      "Flask serves built frontend assets for production while Vite serves SPA in development.",
      "Auth state is checked client-side using /api/auth/status and enforced with route guards.",
    ],
    snippets: [
      {
        title: "Component boundaries",
        code: "frontend/src/App.tsx -> Page routing and auth gates\nfrontend/components/ui/* -> visual modules\nmain_app.py -> auth, analysis, persistence, integrations",
      },
    ],
  },
  {
    id: "routes",
    icon: Link2,
    title: "Route Map",
    summary: "Primary product routes and intended access model.",
    content: [
      "Public routes: /, /home, /login, /register, /forget-password, /docs.",
      "Protected routes: /dashboard, /analyse, /analyze, /integrations, /team.",
      "Auth helper API: /api/auth/status for client-side gate checks.",
      "Username API: /check_username for live register availability checks.",
      "Alias support keeps /analyse and /analyze both valid for compatibility.",
      "Password reset aliases support /forget-password, /forgot-password, and /forgot_password.",
    ],
    snippets: [
      {
        title: "Core protected route policy",
        code: "Unauthenticated -> redirect to /login\nAuthenticated -> allow /dashboard /analyse /integrations /team",
      },
    ],
  },
  {
    id: "auth-flow",
    icon: Lock,
    title: "Authentication Flow",
    summary: "Registration, verification, login, and reset lifecycle.",
    content: [
      "Register: validates username/email/password and sends verification OTP.",
      "Verify email: OTP gate ensures accounts are activated before login.",
      "Login: verifies password and redirects to dashboard after authentication.",
      "Reset password: sends reset code then validates code before password update.",
      "Frontend route guards ensure protected pages are never shown to guest sessions.",
    ],
    snippets: [
      {
        title: "Auth status payload",
        code: "{\n  \"success\": true,\n  \"authenticated\": false,\n  \"user\": null\n}",
      },
    ],
  },
  {
    id: "analysis",
    icon: Gauge,
    title: "Transcript Analysis",
    summary: "How meeting text becomes structured execution data.",
    content: [
      "Input supports plain transcript text and optional file upload.",
      "Backend validates size and file type, then extracts text where needed.",
      "AI prompt requests strict JSON schema including summary, decisions, topics, and action items.",
      "Normalization enriches priorities, due dates, and context from transcript signals.",
      "Output is persisted so users can revisit meeting intelligence and task boards.",
      "Gemini fallback chain increases resilience if one model returns empty/error output.",
    ],
    snippets: [
      {
        title: "High-level analysis output",
        code: "summary\ndecisions[]\ntopics[]\naction_items[]\nai_insight[]\nsuggested_execution_order[]\nrisks[]",
      },
    ],
  },
  {
    id: "ai-models",
    icon: Cpu,
    title: "AI Model Strategy",
    summary: "Model defaults and fallback behavior for reliability.",
    content: [
      "Configured models include gemini-2.0-flash, gemini-2.5-flash, and gemini-3-flash.",
      "Analysis endpoint defaults to GEMINI_ANALYSIS_MODEL unless overridden by backend defaults.",
      "Fallback order prioritizes higher capability while preserving fast failover.",
      "System returns explicit error details when all model attempts fail.",
      "Always keep API key in backend environment only.",
    ],
  },
  {
    id: "uploads",
    icon: FileText,
    title: "Transcript Uploads",
    summary: "File extraction support and validation behavior.",
    content: [
      "Supported formats: TXT, DOC, DOCX, PDF.",
      "Maximum upload size is enforced server-side.",
      "Extracted file text is merged with textarea transcript content when both are provided.",
      "Word-count guard prevents oversized prompts from degrading quality.",
      "Upload preview API: /api/transcript/extract-file.",
    ],
  },
  {
    id: "integrations",
    icon: ListChecks,
    title: "Integrations",
    summary: "Execution hand-off to Trello and Jira.",
    content: [
      "Trello integration can create cards from extracted action items.",
      "Jira integration can create issues with mapped fields and project context.",
      "Integration endpoints are login-protected and tied to each user account.",
      "Connection status is visible through /api/integrations/status.",
      "Automation can be toggled per request depending on available connection setup.",
    ],
  },
  {
    id: "notifications",
    icon: Sparkles,
    title: "Notifications",
    summary: "Email and optional channel updates after analysis actions.",
    content: [
      "Welcome and verification emails are triggered in auth flows.",
      "Integration success emails are sent after successful Trello/Jira/Slack connections.",
      "Summary email automation can distribute decisions and action items to team members.",
      "Notification failures are surfaced in logs and automation status messages.",
    ],
  },
  {
    id: "security",
    icon: ShieldCheck,
    title: "Security & Privacy",
    summary: "Session safety, private data, and credential handling.",
    content: [
      "Authentication uses Flask-Login with session cookies.",
      "User-specific data access is enforced through login-required routes and user_id scoping.",
      "Credentials for integrations are stored in MongoDB and only used server-side.",
      "Never expose secrets in frontend source or logs.",
      "Sensitive chat payloads are redacted before storage to reduce leakage risk.",
    ],
  },
  {
    id: "env",
    icon: KeyRound,
    title: "Environment Variables",
    summary: "Required keys for core and optional features.",
    content: [
      "Core: MONGO_URI (or MONGO_URL), GEMINI_API_KEY, FLASK_SECRET_KEY.",
      "Gemini models: GEMINI_MODEL_20, GEMINI_MODEL_25, GEMINI_MODEL_3, GEMINI_ANALYSIS_MODEL.",
      "Email: GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN.",
      "Trello: TRELLO_API_KEY, TRELLO_API_SECRET.",
      "Missing optional values disable related capabilities without blocking core auth + analysis flows.",
      "Frontend local override: VITE_BACKEND_URL can point proxy to non-default backend host/port.",
    ],
  },
  {
    id: "database",
    icon: Database,
    title: "Database Notes",
    summary: "Collections and persistence behavior.",
    content: [
      "Users store identity, password hash, team membership, and verification state.",
      "MeetingInsight stores transcript excerpt, summary, topics, and decisions.",
      "WorkActionItem stores normalized tasks with due dates, priority, status, and context notes.",
      "TrelloCredentials and JiraCredentials store per-user integration connection data.",
      "ChatMessage stores assistant history and selected/actual model metadata.",
    ],
  },
  {
    id: "api-reference",
    icon: Code2,
    title: "API Reference (Key Endpoints)",
    summary: "Most-used routes for frontend and integrations.",
    content: [
      "GET /api/auth/status -> auth state for route guards.",
      "POST /check_username -> live register username validation.",
      "POST /register, POST /login, GET /logout -> core auth lifecycle.",
      "POST /analyse (alias /analyze) -> transcript AI analysis.",
      "POST /api/transcript/extract-file -> extract text preview from upload.",
      "GET /api/integrations/status -> Trello/Jira connection status.",
      "POST /api/ai-chat/send -> assistant chat with model metadata.",
    ],
    snippets: [
      {
        title: "Analyse request form fields",
        code: "transcript: string\nfile: optional upload\ncreate_trello_cards: true|false\ncreate_jira_tickets: true|false",
      },
      {
        title: "Analyse success envelope",
        code: "{\n  \"success\": true,\n  \"analysis\": { ...structured payload... },\n  \"automation_messages\": []\n}",
      },
    ],
  },
  {
    id: "frontend-guidelines",
    icon: Globe,
    title: "Frontend Guidelines",
    summary: "UI consistency, route patterns, and dev ergonomics.",
    content: [
      "Keep components in frontend/components/ui and shared utilities in frontend/lib.",
      "Use route aliases conservatively; always provide a canonical path in nav links.",
      "Guard protected routes with auth checks to prevent accidental guest exposure.",
      "Prefer minimal high-contrast blocks; use layered dark gradients for premium feel.",
      "Validate mobile layouts for navbar, timeline cards, and auth forms.",
    ],
  },
  {
    id: "backend-guidelines",
    icon: Server,
    title: "Backend Guidelines",
    summary: "Flask routing and data handling practices for this project.",
    content: [
      "Always use login_required for user-sensitive routes.",
      "Return JSON payloads for API and AJAX flows, flash/redirect for template form flows.",
      "Normalize and validate AI output before persistence.",
      "Capture integration errors and return user-actionable messages.",
      "Do not log raw secrets or tokens in production logs.",
    ],
  },
  {
    id: "networking",
    icon: Network,
    title: "Local Networking & Proxy",
    summary: "Why frontend proxy is required in development.",
    content: [
      "Vite runs on 5173 while Flask runs on 5001, so same-origin browser calls would fail without proxy.",
      "Proxy keeps frontend calls simple (/api/*, /check_username, /login, /register) and cookie behavior consistent.",
      "If proxy is missing, register live-check often shows fallback message because HTML/errors are returned instead of JSON.",
      "Set VITE_BACKEND_URL when backend host differs from localhost:5001.",
    ],
  },
  {
    id: "troubleshooting",
    icon: Bug,
    title: "Troubleshooting",
    summary: "Fix common local setup and runtime issues quickly.",
    content: [
      "If live username check fails in dev, ensure frontend proxy points to backend :5001.",
      "If login works but protected pages bounce, verify /api/auth/status response and cookie domain.",
      "If analysis fails, confirm GEMINI_API_KEY is loaded and model names are valid.",
      "If file upload errors appear, verify allowed extension and size limits.",
      "If integrations fail, re-check tokens and service account scopes.",
      "If register page shows blank/white screen, inspect browser console and Vite terminal for runtime exceptions.",
      "If eyes look misaligned on auth hero image, confirm image source dimensions are stable and clear cache.",
    ],
  },
  {
    id: "alerts",
    icon: AlertTriangle,
    title: "Operational Alerts",
    summary: "Signals that need immediate attention.",
    content: [
      "Repeated AI model failures across fallback chain.",
      "MongoDB connection instability or authentication failures.",
      "Integration auth errors (401/403) for Trello or Jira.",
      "Unexpected growth in failed username checks indicating proxy regression.",
      "Route guard loops where authenticated users are redirected to login.",
    ],
  },
  {
    id: "release-checklist",
    icon: CheckCircle2,
    title: "Release Checklist",
    summary: "Pre-release validation for stable deployment.",
    content: [
      "Run frontend build and confirm no TypeScript errors.",
      "Run backend startup and verify env configuration status is healthy.",
      "Test full auth flow: register, verify email, login, logout, reset password.",
      "Test protected route access and guest redirects.",
      "Run transcript analysis with text and with file upload.",
      "Validate integration status endpoint and at least one create-card/create-issue flow.",
    ],
  },
  {
    id: "deployment",
    icon: Terminal,
    title: "Deployment",
    summary: "Production guidance and checklist.",
    content: [
      "Build frontend with npm run build and ensure dist is available for Flask serving.",
      "Set production environment variables in deployment platform.",
      "Use HTTPS in production and secure cookie settings.",
      "Monitor logs for auth, AI, and integration failures.",
      "Rotate secrets periodically and revoke leaked keys immediately.",
      "Confirm frontend fallback serves index.html for SPA routes while preserving API path handling.",
    ],
  },
];

export default function DocumentationHub() {
  const [activeId, setActiveId] = useState<string>(sections[0].id);
  const activeSection = useMemo(
    () => sections.find((section) => section.id === activeId) || sections[0],
    [activeId]
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 md:py-16">
      <header className="rounded-3xl border border-white/12 bg-[radial-gradient(120%_180%_at_10%_-10%,rgba(255,255,255,0.14),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-8 md:p-10">
        <p className="text-xs uppercase tracking-[0.22em] text-white/55">Documentation</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-6xl">AI Meeting Agent Docs</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-white/72 md:text-base">
          Complete product documentation for setup, authentication, transcript analysis,
          integrations, deployment, and troubleshooting. This page is intentionally deep so
          engineering and operations teams can execute without ambiguity.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60">
          Use this as the source of truth for route behavior, API contracts, model handling,
          environment policy, and reliability checks.
        </p>
      </header>

      <section className="mt-8 grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="rounded-3xl border border-white/12 bg-white/[0.03] p-4">
          <p className="mb-3 px-2 text-[11px] uppercase tracking-[0.22em] text-white/50">Sections</p>
          <div className="grid gap-1.5">
            {sections.map((section) => {
              const Icon = section.icon;
              const active = section.id === activeId;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveId(section.id)}
                  className={`rounded-xl border px-3 py-2 text-left transition ${
                    active
                      ? "border-white/45 bg-white/[0.1]"
                      : "border-white/10 bg-black/40 hover:border-white/25"
                  }`}
                  type="button"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-white/70" />
                    <p className="text-sm font-medium text-white">{section.title}</p>
                  </div>
                  <p className="mt-1 text-xs text-white/60">{section.summary}</p>
                </button>
              );
            })}
          </div>
        </aside>

        <article className="rounded-3xl border border-white/12 bg-white/[0.03] p-6 md:p-8">
          <div className="flex items-center gap-2">
            <activeSection.icon className="h-5 w-5 text-white/70" />
            <h2 className="text-2xl font-semibold md:text-3xl">{activeSection.title}</h2>
          </div>
          <p className="mt-2 text-sm text-white/68">{activeSection.summary}</p>

          <div className="mt-6 grid gap-3">
            {activeSection.content.map((paragraph) => (
              <p key={paragraph} className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm leading-7 text-white/82">
                {paragraph}
              </p>
            ))}
          </div>

          {activeSection.snippets && activeSection.snippets.length > 0 && (
            <div className="mt-6 grid gap-3">
              {activeSection.snippets.map((snippet) => (
                <div key={snippet.title} className="rounded-2xl border border-white/12 bg-black/80 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">{snippet.title}</p>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-sm text-zinc-200">
{snippet.code}
                  </pre>
                </div>
              ))}
            </div>
          )}

          {activeSection.commands && activeSection.commands.length > 0 && (
            <div className="mt-6 rounded-2xl border border-white/15 bg-black p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">Commands</p>
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-sm text-emerald-200">
{activeSection.commands.map((cmd) => `$ ${cmd}`).join("\n")}
              </pre>
            </div>
          )}

          <div className="mt-8 rounded-2xl border border-white/12 bg-black/35 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">Operational Note</p>
            <p className="mt-2 text-sm leading-7 text-white/75">
              Keep backend and frontend running together for local development. The React app
              depends on Flask auth and API endpoints for live route protection, username checks,
              transcript analysis, and integration status.
            </p>
          </div>
        </article>
      </section>
    </main>
  );
}
