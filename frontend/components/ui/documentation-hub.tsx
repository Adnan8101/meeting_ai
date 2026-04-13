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
  GitBranch,
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

type DocMatrix = {
  title: string;
  headers: string[];
  rows: string[][];
};

type DocDiagram = {
  title: string;
  type: "mermaid" | "ascii";
  content: string;
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
  matrices?: DocMatrix[];
  diagrams?: DocDiagram[];
};

const categories: DocCategory[] = [
  {
    id: "foundation",
    label: "Foundation",
    summary: "Core scope, users, and setup baseline.",
    icon: BookOpen,
  },
  {
    id: "architecture",
    label: "Architecture",
    summary: "System shape, boundaries, and internals.",
    icon: Workflow,
  },
  {
    id: "workflows",
    label: "Workflows",
    summary: "Auth, analysis, and delivery flows.",
    icon: Activity,
  },
  {
    id: "platform",
    label: "Database And Platform",
    summary: "Schema, security, env, and networking.",
    icon: Database,
  },
  {
    id: "reference",
    label: "API Reference",
    summary: "Endpoint contracts and request behavior.",
    icon: Code2,
  },
  {
    id: "operations",
    label: "Operations",
    summary: "Readiness, troubleshooting, and release.",
    icon: Terminal,
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
    summary: "What AI Meeting Agent does and why teams use it.",
    highlights: [
      "Transforms meeting transcripts into structured output: summary, decisions, topics, tasks, risks, and execution order.",
      "Reduces manual task extraction and keeps accountability visible after every meeting.",
      "Combines AI analysis, persistent storage, and delivery integrations in one workflow.",
      "Supports human review plus optional automation to Trello and Jira.",
      "Works for recurring team rituals where consistency and traceability are required.",
      "Designed for production readiness with route guards, model fallback, and operational checks.",
    ],
    checklist: [
      "Confirm transcript inputs include concrete decisions and owner context.",
      "Review generated action items before creating external tickets.",
      "Use persisted history to prevent duplicate execution.",
    ],
  },
  {
    id: "personas",
    category: "foundation",
    icon: UserCheck,
    title: "Primary Personas",
    summary: "Role-focused outcomes for each stakeholder.",
    highlights: [
      "Frontend developers need clear UX-ready action items and timeline visibility.",
      "AI engineers need prompt quality control and model fallback confidence.",
      "Backend developers need stable API contracts and persistence consistency.",
      "Cloud and database owners need secure credential handling and deployment safety.",
      "Product and team leads need quick clarity on decisions, blockers, and delivery scope.",
    ],
  },
  {
    id: "quickstart",
    category: "foundation",
    icon: Rocket,
    title: "Quick Start",
    summary: "Run full stack locally with correct order and checks.",
    highlights: [
      "Start backend before frontend so auth and analysis endpoints are ready.",
      "Run Vite frontend for docs, dashboard, analysis, and integrations UI.",
      "Local default expects Flask at 5001 and Vite at 5173.",
      "Keep both services alive for end-to-end behavior.",
    ],
    commands: [
      "cd hamza-meeting",
      "python run.py",
      "cd frontend",
      "npm install",
      "npm run dev",
      "npm run build",
    ],
    snippets: [
      {
        title: "Local URLs",
        code: "Frontend: http://localhost:5173\nBackend: http://localhost:5001",
      },
    ],
    checklist: [
      "Check /api/auth/status returns JSON.",
      "Check /docs and /login render correctly.",
      "Check /dashboard guard redirects guests.",
    ],
  },
  {
    id: "system-architecture",
    category: "architecture",
    icon: Server,
    title: "System Architecture",
    summary: "Frontend, backend, AI, and database interaction model.",
    highlights: [
      "Frontend uses React + Vite + TypeScript with route guards and lazy-loaded pages.",
      "Backend uses Flask for auth, transcript processing, integrations, and chat endpoints.",
      "AI analysis uses Gemini model selection with fallback behavior to improve reliability.",
      "Database persistence stores users, meeting insights, action items, credentials, and chat logs.",
      "SPA shell is served in production with API routes preserved on Flask side.",
      "User session state is checked through auth status endpoint.",
    ],
    diagrams: [
      {
        title: "High-Level Architecture",
        type: "mermaid",
        content:
          "flowchart LR\n  U[User Browser] --> FE[React Frontend: Vite SPA]\n  FE -->|Auth and API Calls| BE[Flask Backend]\n  BE -->|SQLAlchemy| DB[(PostgreSQL or SQLite Fallback)]\n  BE -->|Transcript Analysis| AI[Gemini Model Chain]\n  BE -->|Optional Automation| T[Trello API]\n  BE -->|Optional Automation| J[Jira API]\n  BE -->|Email Events| M[Email Service]",
      },
      {
        title: "Runtime Boundaries",
        type: "ascii",
        content:
          "+-------------------------- CLIENT --------------------------+\n| React routes | UI components | Auth guard | Docs tabs       |\n+------------------------------|----------------------------+\n                               | HTTP JSON\n+-------------------------- SERVER --------------------------+\n| Flask auth | Analyse pipeline | Integrations | Chat API       |\n| Validation | Persistence layer | Token handling            |\n+------------------------------|----------------------------+\n                               | SQL\n+------------------------- DATA LAYER -----------------------+\n| users | meeting_insights | work_action_items | chat_messages  |\n| trello_credentials | jira_credentials | teams | trello_cards  |\n+------------------------------------------------------------+",
      },
    ],
    snippets: [
      {
        title: "Responsibility map",
        code:
          "frontend/src/App.tsx -> routing and auth gates\nfrontend/components/ui/* -> UI systems and docs\nmain_app.py -> auth, analyse, integrations, chat\nmodels.py -> persistence schema and table models",
      },
    ],
  },
  {
    id: "deployment-architecture",
    category: "architecture",
    icon: GitBranch,
    title: "Deployment Architecture",
    summary: "Build pipeline, hosting behavior, and fallback routing.",
    highlights: [
      "Frontend build output is served by Flask in production mode.",
      "Serverless entry path uses api index routing and vercel configuration.",
      "API and static-like prefixes are protected from accidental SPA catch-all.",
      "Database boot logic supports PostgreSQL first and SQLite fallback when needed.",
      "Connection strategy adapts to serverless and long-running runtime modes.",
    ],
    diagrams: [
      {
        title: "Deploy Flow",
        type: "mermaid",
        content:
          "flowchart TD\n  A[Code Push] --> B[Frontend Build: npm run build]\n  B --> C[Flask Serves Built SPA]\n  C --> D[Runtime Boot]\n  D --> E{Database URL Valid?}\n  E -->|Yes| F[PostgreSQL Driver Selection]\n  E -->|No| G[SQLite Fallback]\n  F --> H[API + Auth + Analysis Live]\n  G --> H",
      },
    ],
    checklist: [
      "Build frontend before deploying backend shell.",
      "Verify SPA fallback does not intercept API prefixes.",
      "Verify runtime database URI resolves successfully.",
    ],
  },
  {
    id: "auth-flow",
    category: "workflows",
    icon: Lock,
    title: "Authentication Working Flow",
    summary: "Registration, verification, login, and reset process.",
    highlights: [
      "Register validates username, email, and password before account creation.",
      "Verification OTP is generated and expiry is enforced.",
      "Login checks password hash and verified state for access.",
      "Forgot password issues reset token with expiry window.",
      "Route guards redirect unauthenticated users to login.",
      "Auth status endpoint drives frontend protected route policy.",
    ],
    diagrams: [
      {
        title: "Auth Flowchart",
        type: "mermaid",
        content:
          "flowchart TD\n  A[User Register] --> B[Create User + Verification OTP]\n  B --> C{OTP Valid and Not Expired?}\n  C -->|Yes| D[Mark Verified]\n  C -->|No| E[Reject Verification]\n  D --> F[User Login]\n  F --> G{Password Valid?}\n  G -->|Yes| H[Start Session]\n  G -->|No| I[Auth Error]\n  H --> J[Access Protected Routes]\n  J --> K[Logout -> Session Cleared]",
      },
    ],
    snippets: [
      {
        title: "Auth status payload",
        code: "{\n  \"success\": true,\n  \"authenticated\": false,\n  \"user\": null\n}",
      },
    ],
    checklist: [
      "Test register to verify flow with valid and invalid OTP.",
      "Test login with wrong password and non-verified account.",
      "Test reset flow with expired token handling.",
    ],
  },
  {
    id: "analysis-flow",
    category: "workflows",
    icon: Gauge,
    title: "Transcript Analysis Working Flow",
    summary: "End-to-end pipeline from input to persistent execution output.",
    highlights: [
      "Accepts transcript text plus optional file upload in one request.",
      "Applies format, size, and word-limit validations before AI call.",
      "Generates strict prompt for structured JSON response.",
      "Uses model fallback chain for resilience.",
      "Normalizes output and persists insights and tasks.",
      "Optionally triggers Trello and Jira automation after successful analysis.",
    ],
    diagrams: [
      {
        title: "Analysis Flowchart",
        type: "mermaid",
        content:
          "flowchart TD\n  A[Transcript Input] --> B[Validate Input and File]\n  B --> C[Build Prompt]\n  C --> D[Run Gemini Primary Model]\n  D -->|Fail| E[Fallback Model Chain]\n  D -->|Success| F[Normalize Structured Output]\n  E --> F\n  F --> G[Store MeetingInsight]\n  G --> H[Store WorkActionItems]\n  H --> I{Automation Requested?}\n  I -->|Yes| J[Create Trello Cards and or Jira Issues]\n  I -->|No| K[Return Analysis JSON]\n  J --> K",
      },
    ],
    snippets: [
      {
        title: "Structured output keys",
        code:
          "summary\ndecisions[]\ntopics[]\naction_items[]\nai_insight[]\nsuggested_execution_order[]\nrisks[]",
      },
      {
        title: "Analyse request fields",
        code:
          "transcript: string\nfile: optional\ncreate_trello_cards: boolean\ncreate_jira_tickets: boolean",
      },
    ],
    checklist: [
      "Run text-only and file-plus-text cases.",
      "Test long transcript near configured limits.",
      "Verify persistence and dashboard visibility after refresh.",
    ],
  },
  {
    id: "integration-flow",
    category: "workflows",
    icon: ListChecks,
    title: "Integration Working Flow",
    summary: "Credential connect, status check, and execution push.",
    highlights: [
      "Trello and Jira credentials are user scoped and server-side only.",
      "Status endpoint reports connection state for frontend indicators.",
      "Automation is optional per analysis request.",
      "Disconnect endpoints support credential lifecycle control.",
      "Errors are returned with actionable messages for UI to display.",
    ],
    diagrams: [
      {
        title: "Integration Sequence",
        type: "mermaid",
        content:
          "sequenceDiagram\n  participant U as User\n  participant FE as Frontend\n  participant BE as Flask Backend\n  participant T as Trello/Jira API\n  U->>FE: Connect account\n  FE->>BE: POST connect endpoint\n  BE->>T: Validate token and profile\n  T-->>BE: Auth result\n  BE-->>FE: success and message\n  U->>FE: Analyse with automation\n  FE->>BE: POST analyse\n  BE->>T: Create cards/issues\n  T-->>BE: IDs and status\n  BE-->>FE: Analysis + automation_messages",
      },
    ],
    checklist: [
      "Connect and disconnect both integrations at least once.",
      "Run one automation-enabled analysis for each integration.",
      "Verify integration status endpoint matches UI badge state.",
    ],
  },
  {
    id: "database-schema",
    category: "platform",
    icon: Database,
    title: "Database Schema",
    summary: "Concrete tables and key fields used by the application.",
    highlights: [
      "All models use compact string primary id values for compatibility.",
      "User-centric schema design uses user id scoping across records.",
      "Action items and meeting insights are persisted separately for flexible querying.",
      "Credential tables are one-to-one per user for Trello and Jira connections.",
      "Chat messages preserve selected model and actual model metadata for auditability.",
    ],
    matrices: [
      {
        title: "Core tables",
        headers: ["Table", "Primary purpose", "Important columns"],
        rows: [
          [
            "users",
            "Authentication and account identity",
            "username, email, password_hash, is_verified, verification_token, reset_token",
          ],
          [
            "meeting_insights",
            "Persisted meeting analysis",
            "user_id, team_id, title, summary, topics(JSON), decisions(JSON), participants(JSON)",
          ],
          [
            "work_action_items",
            "Task execution backlog",
            "user_id, meeting_id, task, assignee, due_date, priority, status, context_notes",
          ],
          [
            "chat_messages",
            "Assistant conversation history",
            "user_id, role, content, selected_model, actual_model, created_at",
          ],
        ],
      },
      {
        title: "Integration tables",
        headers: ["Table", "Purpose", "Important columns"],
        rows: [
          ["trello_credentials", "Stores user Trello token", "user_id(unique), token, trello_username"],
          ["jira_credentials", "Stores user Jira API connection", "user_id(unique), jira_url, email, api_token"],
          ["trello_cards", "Tracks created Trello cards", "card_id(unique), user_id, board_id, list_id, task_description"],
          ["teams", "Team ownership and collaboration", "name, owner_id, slack_webhook_url"],
        ],
      },
    ],
    checklist: [
      "Ensure indexes exist on user_id and time-based query columns.",
      "Validate unique constraints for username, email, and credential user ids.",
      "Review token storage security policy before production.",
    ],
  },
  {
    id: "database-relations",
    category: "platform",
    icon: Link2,
    title: "Database Relationships And ER Diagram",
    summary: "Logical relationships between main entities.",
    highlights: [
      "One user can create many meeting insights and work action items.",
      "One user can have many chat messages ordered by creation time.",
      "Trello and Jira credential rows are one per user.",
      "A meeting insight can produce many work action items through meeting id linking.",
      "Team id can be shared across users and meeting insights for grouping.",
    ],
    diagrams: [
      {
        title: "ER Diagram",
        type: "mermaid",
        content:
          "erDiagram\n  USERS ||--o{ MEETING_INSIGHTS : creates\n  USERS ||--o{ WORK_ACTION_ITEMS : owns\n  USERS ||--o{ CHAT_MESSAGES : writes\n  USERS ||--|| TRELLO_CREDENTIALS : has\n  USERS ||--|| JIRA_CREDENTIALS : has\n  USERS }o--|| TEAMS : belongs_to\n  MEETING_INSIGHTS ||--o{ WORK_ACTION_ITEMS : produces\n  USERS ||--o{ TRELLO_CARDS : creates",
      },
    ],
    snippets: [
      {
        title: "Foreign-key style links used logically",
        code:
          "users.id -> meeting_insights.user_id\nusers.id -> work_action_items.user_id\nusers.id -> chat_messages.user_id\nusers.id -> trello_credentials.user_id\nusers.id -> jira_credentials.user_id\nmeeting_insights.id -> work_action_items.meeting_id",
      },
    ],
  },
  {
    id: "ai-model-strategy",
    category: "platform",
    icon: Cpu,
    title: "AI Model Strategy",
    summary: "Configured models, fallback, and failure handling.",
    highlights: [
      "Primary model key is controlled by GEMINI_ANALYSIS_MODEL.",
      "Model chain includes GEMINI_MODEL_20, GEMINI_MODEL_25, GEMINI_MODEL_3 values.",
      "Fallback API keys can be configured to reduce outages.",
      "Analysis returns explicit errors if all model attempts fail.",
      "Model metadata can be logged in chat history for diagnostics.",
    ],
    checklist: [
      "Validate each configured model id against provider availability.",
      "Test fallback by forcing primary key failure in non-production.",
      "Track latency and success rate during load tests.",
    ],
  },
  {
    id: "environment",
    category: "platform",
    icon: KeyRound,
    title: "Environment Configuration",
    summary: "Required and optional variables that control runtime behavior.",
    highlights: [
      "Core: DATABASE_URL or POSTGRES_URL, FLASK_SECRET_KEY, GEMINI_API_KEY.",
      "Model controls: GEMINI_MODEL_20, GEMINI_MODEL_25, GEMINI_MODEL_3, GEMINI_ANALYSIS_MODEL.",
      "Email controls: GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN.",
      "Integration controls: TRELLO_API_KEY, TRELLO_API_SECRET.",
      "Optional flags include quiet logs and bootstrap control for specific runtime conditions.",
      "VITE_BACKEND_URL may be used for non-default local backend host.",
    ],
    snippets: [
      {
        title: "Minimal runtime",
        code: "DATABASE_URL=...\nFLASK_SECRET_KEY=...\nGEMINI_API_KEY=...",
      },
    ],
  },
  {
    id: "security",
    category: "platform",
    icon: ShieldCheck,
    title: "Security And Privacy",
    summary: "Session safety, data isolation, and credential handling policy.",
    highlights: [
      "Auth-protected routes rely on login checks before returning user data.",
      "Sensitive credentials are stored and used server-side only.",
      "Session cookies should use secure settings in production.",
      "Never expose raw access tokens in frontend source or logs.",
      "Scope all data by authenticated user id to prevent cross-account exposure.",
    ],
    checklist: [
      "Audit logs for accidental token exposure patterns.",
      "Verify session cookie flags in production runtime.",
      "Validate unauthorized requests are rejected with proper status code.",
    ],
  },
  {
    id: "network-proxy",
    category: "platform",
    icon: Network,
    title: "Networking And Proxy",
    summary: "How dev networking and proxying must behave.",
    highlights: [
      "Vite and Flask run on different ports, requiring proxy for clean browser calls.",
      "Proxy keeps request URLs simple and preserves cookie behavior.",
      "Bad proxy setup commonly breaks username check and auth status flows.",
      "SPA routes should remain frontend handled and not be proxied as API calls.",
      "Production serving keeps API prefixes separate from static route fallback.",
    ],
    checklist: [
      "Verify /api/auth/status from frontend context returns JSON.",
      "Verify /check_username returns JSON, not HTML.",
      "Verify /analyse route remains client-side and functional.",
    ],
  },
  {
    id: "api-reference",
    category: "reference",
    icon: Code2,
    title: "API Endpoint Reference",
    summary: "Expanded endpoint map used by frontend and automation flows.",
    highlights: [
      "Includes auth lifecycle, analysis, dashboard state, integrations, and chat endpoints.",
      "Covers both direct UI routes and API namespace routes where applicable.",
      "Use this section for QA validation scripts and integration checks.",
    ],
    endpoints: [
      { method: "GET", path: "/api/auth/status", description: "Returns session auth state.", auth: "public" },
      { method: "POST", path: "/api/auth/register", description: "API registration endpoint.", auth: "public" },
      { method: "POST", path: "/api/auth/login", description: "API login endpoint.", auth: "public" },
      { method: "POST", path: "/api/auth/forgot-password", description: "Starts reset flow.", auth: "public" },
      { method: "POST", path: "/api/auth/logout", description: "API logout endpoint.", auth: "protected" },
      { method: "POST", path: "/check_username", description: "Username availability check.", auth: "public" },
      { method: "POST", path: "/api/analyse", description: "Analyse alias under API namespace.", auth: "protected" },
      { method: "POST", path: "/api/analyze", description: "Analyze alias under API namespace.", auth: "protected" },
      { method: "POST", path: "/api/transcript/extract-file", description: "Extracts text from uploaded file.", auth: "protected" },
      { method: "GET", path: "/api/dashboard/context", description: "Returns dashboard context payload.", auth: "protected" },
      { method: "POST", path: "/api/dashboard/store-analysis", description: "Stores analysis into dashboard context.", auth: "protected" },
      { method: "POST", path: "/api/dashboard/task", description: "Creates task record.", auth: "protected" },
      { method: "PATCH", path: "/api/dashboard/task/<task_id>", description: "Updates task record.", auth: "protected" },
      { method: "DELETE", path: "/api/dashboard/task/<task_id>", description: "Deletes task record.", auth: "protected" },
      { method: "DELETE", path: "/api/dashboard/meeting/<meeting_id>", description: "Deletes meeting and related records.", auth: "protected" },
      { method: "GET", path: "/api/integrations/status", description: "Returns Trello and Jira connection status.", auth: "protected" },
      { method: "GET", path: "/api/integrations/trello-token-url", description: "Returns Trello token generation URL.", auth: "protected" },
      { method: "POST", path: "/api/chat/connect/jira", description: "Connects Jira credentials.", auth: "protected" },
      { method: "POST", path: "/api/chat/connect/trello", description: "Connects Trello credentials.", auth: "protected" },
      { method: "POST", path: "/api/chat/disconnect/trello", description: "Disconnects Trello credentials.", auth: "protected" },
      { method: "GET", path: "/api/ai-chat/history", description: "Reads chat history.", auth: "protected" },
      { method: "POST", path: "/api/ai-chat/send", description: "Sends AI chat prompt.", auth: "protected" },
      { method: "POST", path: "/api/ai-chat/clear", description: "Clears chat history.", auth: "protected" },
      { method: "GET", path: "/api/health/db", description: "Database health signal.", auth: "public" },
    ],
    snippets: [
      {
        title: "Analyse success envelope",
        code: "{\n  \"success\": true,\n  \"analysis\": { ...structured payload... },\n  \"automation_messages\": []\n}",
      },
    ],
  },
  {
    id: "upload-rules",
    category: "reference",
    icon: FileText,
    title: "Upload And Content Rules",
    summary: "Validation behavior for transcript text and file uploads.",
    highlights: [
      "Supported file types are txt, doc, docx, and pdf.",
      "Default max file size is controlled server-side.",
      "Word limits are applied to protect model quality and runtime cost.",
      "Typed transcript and extracted file text can be merged.",
      "Invalid file types should return clear JSON error response.",
    ],
    checklist: [
      "Test unsupported extension error handling.",
      "Test oversize file rejection path.",
      "Test mixed content merge path for transcript plus file.",
    ],
  },
  {
    id: "service-readiness",
    category: "operations",
    icon: CheckCircle2,
    title: "Service Readiness",
    summary: "Fast checks before demo, QA, or release validation.",
    highlights: [
      "Backend boots and responds to auth status route.",
      "Frontend routes load without runtime exceptions.",
      "Analysis request returns structured payload.",
      "Dashboard context endpoints read and write successfully.",
      "Integration status endpoint returns expected shape.",
    ],
    checklist: [
      "Smoke test public routes and docs.",
      "Smoke test protected routes with authenticated session.",
      "Run one complete analysis and verify persisted records.",
    ],
  },
  {
    id: "troubleshooting",
    category: "operations",
    icon: AlertTriangle,
    title: "Troubleshooting",
    summary: "Common failures and direct resolution steps.",
    highlights: [
      "Username check failing in dev usually means proxy target mismatch.",
      "Protected route redirect loops usually indicate auth status or cookie issue.",
      "Analysis failures often trace to missing API key or invalid model name.",
      "Upload failures usually map to extension or size validation.",
      "Integration failures usually map to invalid token or API scope mismatch.",
      "Blank page usually maps to frontend runtime errors visible in browser console.",
    ],
    checklist: [
      "Capture request and response payload for failing endpoint.",
      "Confirm env values loaded in active process.",
      "Verify fallback behavior for AI and DB remains available.",
    ],
  },
  {
    id: "release-deploy",
    category: "operations",
    icon: Terminal,
    title: "Release And Deployment",
    summary: "Pre-release and production deployment checklist.",
    highlights: [
      "Run frontend build and verify route behavior.",
      "Verify register, verify email, login, logout, and reset flows.",
      "Run analysis with and without automation toggles.",
      "Verify integration connect and status behavior.",
      "Use HTTPS and secure session cookie policy in production.",
      "Monitor logs for auth, database, and model errors after deploy.",
    ],
    commands: [
      "cd frontend",
      "npm run build",
      "cd ..",
      "python run.py",
    ],
    diagrams: [
      {
        title: "Release Flow",
        type: "mermaid",
        content:
          "flowchart TD\n  A[Build Frontend] --> B[Boot Backend]\n  B --> C[Run Auth Tests]\n  C --> D[Run Analysis Tests]\n  D --> E[Run Integration Tests]\n  E --> F{All Checks Pass?}\n  F -->|Yes| G[Deploy]\n  F -->|No| H[Fix and Re-test]",
      },
    ],
    checklist: [
      "Verify docs route is available post deployment.",
      "Verify API routes return expected status codes.",
      "Verify DB health endpoint reports success.",
    ],
  },
  {
    id: "ownership",
    category: "operations",
    icon: Bot,
    title: "Ownership",
    summary: "Clear implementation ownership mapping for project operations.",
    highlights: [
      "Frontend ownership: responsive UI, docs UX, route quality, and visual consistency.",
      "AI ownership: prompt design, model behavior, and output quality control.",
      "Backend ownership: API correctness, auth policy, and persistence integrity.",
      "Cloud and database ownership: deployment reliability, connectivity, and data safety.",
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
      diagrams: sections.reduce((total, section) => total + (section.diagrams?.length || 0), 0),
      tables: sections.reduce((total, section) => total + (section.matrices?.length || 0), 0),
    }),
    []
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-5 sm:py-8 lg:px-7 lg:py-10">
      <header className="rounded-3xl border border-white/15 bg-[radial-gradient(120%_150%_at_0%_0%,rgba(255,255,255,0.16),transparent_45%),linear-gradient(170deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-4 sm:p-6 lg:p-7">
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/60">Documentation Hub</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">AI Meeting Agent Docs</h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-white/78 sm:text-[15px] sm:leading-7">
          Professional, clean, and deeply detailed docs for architecture, database schema, working
          flowcharts, APIs, deployment, and operational readiness.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-white/12 bg-black/35 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/55">Tabs</p>
            <p className="mt-0.5 text-xl font-semibold text-white">{counts.categories}</p>
          </div>
          <div className="rounded-xl border border-white/12 bg-black/35 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/55">Sections</p>
            <p className="mt-0.5 text-xl font-semibold text-white">{counts.sections}</p>
          </div>
          <div className="rounded-xl border border-white/12 bg-black/35 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/55">Endpoints</p>
            <p className="mt-0.5 text-xl font-semibold text-white">{counts.endpoints}</p>
          </div>
          <div className="rounded-xl border border-white/12 bg-black/35 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/55">Checks</p>
            <p className="mt-0.5 text-xl font-semibold text-white">{counts.checks}</p>
          </div>
          <div className="rounded-xl border border-white/12 bg-black/35 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/55">Diagrams</p>
            <p className="mt-0.5 text-xl font-semibold text-white">{counts.diagrams}</p>
          </div>
          <div className="rounded-xl border border-white/12 bg-black/35 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/55">DB Tables</p>
            <p className="mt-0.5 text-xl font-semibold text-white">{counts.tables}</p>
          </div>
        </div>
      </header>

      <section className="mt-4 rounded-3xl border border-white/12 bg-white/[0.03] p-3 sm:p-4">
        <p className="mb-2 px-1 text-[10px] uppercase tracking-[0.2em] text-white/55">Category Tabs</p>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          {categories.map((category) => {
            const active = category.id === activeCategory;
            const Icon = category.icon;

            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id)}
                className={`rounded-xl border px-3 py-2.5 text-left transition ${
                  active
                    ? "border-white/45 bg-white/[0.12]"
                    : "border-white/12 bg-black/40 hover:border-white/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-white/80" />
                  <p className="text-sm font-semibold text-white">{category.label}</p>
                </div>
                <p className="mt-0.5 text-xs leading-5 text-white/65">{category.summary}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-4 grid gap-3 lg:grid-cols-[300px_1fr]">
        <aside className="rounded-3xl border border-white/12 bg-white/[0.03] p-3 sm:p-4 lg:sticky lg:top-24 lg:h-fit">
          <p className="mb-2 px-1 text-[10px] uppercase tracking-[0.2em] text-white/55">Section Tabs</p>
          <div className="grid gap-2">
            {sectionsInCategory.map((section) => {
              const active = section.id === activeSection.id;
              const Icon = section.icon;

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveId(section.id)}
                  className={`rounded-xl border px-3 py-2.5 text-left transition ${
                    active
                      ? "border-white/50 bg-white/[0.11]"
                      : "border-white/12 bg-black/35 hover:border-white/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-white/80" />
                    <p className="text-sm font-medium text-white">{section.title}</p>
                  </div>
                  <p className="mt-0.5 text-xs leading-5 text-white/65">{section.summary}</p>
                </button>
              );
            })}
          </div>
        </aside>

        <article className="rounded-3xl border border-white/12 bg-white/[0.03] p-4 sm:p-5 lg:p-6">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-black/35">
              <activeSection.icon className="h-5 w-5 text-white/85" />
            </span>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{activeSection.title}</h2>
              <p className="mt-1 text-sm leading-6 text-white/74 sm:text-[15px] sm:leading-7">{activeSection.summary}</p>
            </div>
          </div>

          <section className="mt-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">Details</p>
            <div className="mt-2 grid gap-2">
              {activeSection.highlights.map((point, index) => (
                <p
                  key={`${activeSection.id}-point-${index}`}
                  className="rounded-xl border border-white/12 bg-black/35 px-3 py-2.5 text-sm leading-6 text-white/84"
                >
                  {point}
                </p>
              ))}
            </div>
          </section>

          {activeSection.diagrams && activeSection.diagrams.length > 0 ? (
            <section className="mt-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">Diagrams</p>
              <div className="mt-2 grid gap-2">
                {activeSection.diagrams.map((diagram) => (
                  <div key={diagram.title} className="rounded-xl border border-white/14 bg-black/80 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/60">{diagram.title}</p>
                      <span className="rounded-full border border-white/20 bg-white/[0.05] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-white/62">
                        {diagram.type}
                      </span>
                    </div>
                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-zinc-200 sm:text-sm">
                      {diagram.content}
                    </pre>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {activeSection.matrices && activeSection.matrices.length > 0 ? (
            <section className="mt-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">Schema Tables</p>
              <div className="mt-2 grid gap-2">
                {activeSection.matrices.map((matrix) => (
                  <div key={matrix.title} className="rounded-xl border border-white/14 bg-black/45 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/60">{matrix.title}</p>
                    <div className="mt-2 overflow-x-auto rounded-lg border border-white/12">
                      <table className="min-w-full border-collapse text-left text-xs sm:text-sm">
                        <thead className="bg-white/[0.06] text-white/80">
                          <tr>
                            {matrix.headers.map((header) => (
                              <th key={header} className="border-b border-white/12 px-3 py-2 font-semibold">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {matrix.rows.map((row, rowIndex) => (
                            <tr key={`${matrix.title}-row-${rowIndex}`} className="bg-black/20">
                              {row.map((cell, cellIndex) => (
                                <td
                                  key={`${matrix.title}-${rowIndex}-${cellIndex}`}
                                  className="border-b border-white/10 px-3 py-2 align-top text-white/82"
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {activeSection.endpoints && activeSection.endpoints.length > 0 ? (
            <section className="mt-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">Endpoint Contracts</p>
              <div className="mt-2 grid gap-2">
                {activeSection.endpoints.map((endpoint) => (
                  <div
                    key={`${endpoint.method}-${endpoint.path}`}
                    className="rounded-xl border border-white/12 bg-black/35 px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${methodTone[endpoint.method]}`}
                      >
                        {endpoint.method}
                      </span>
                      <span className="rounded-full border border-white/18 bg-black/40 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-white/70">
                        {endpoint.auth}
                      </span>
                      <code className="text-xs text-zinc-100 sm:text-sm">{endpoint.path}</code>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-white/80">{endpoint.description}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {activeSection.snippets && activeSection.snippets.length > 0 ? (
            <section className="mt-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">Snippets</p>
              <div className="mt-2 grid gap-2">
                {activeSection.snippets.map((snippet) => (
                  <div key={snippet.title} className="rounded-xl border border-white/14 bg-black/80 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/60">{snippet.title}</p>
                    <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-zinc-200 sm:text-sm">
                      {snippet.code}
                    </pre>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {activeSection.commands && activeSection.commands.length > 0 ? (
            <section className="mt-4 rounded-xl border border-white/15 bg-black p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">Commands</p>
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-emerald-200 sm:text-sm">
                {activeSection.commands.map((command) => `$ ${command}`).join("\n")}
              </pre>
            </section>
          ) : null}

          {activeSection.checklist && activeSection.checklist.length > 0 ? (
            <section className="mt-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">Validation Checklist</p>
              <div className="mt-2 grid gap-2">
                {activeSection.checklist.map((item, index) => (
                  <div
                    key={`${activeSection.id}-check-${index}`}
                    className="rounded-xl border border-emerald-300/22 bg-emerald-500/10 px-3 py-2.5 text-sm leading-6 text-emerald-50"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-4 rounded-xl border border-white/12 bg-black/30 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">Operational Note</p>
            <p className="mt-1 text-sm leading-6 text-white/74">
              Keep backend and frontend running together for complete behavior. Docs verification,
              route guards, auth state checks, analysis, and integrations all depend on live API responses.
            </p>
          </section>
        </article>
      </section>

      <section className="mt-4 rounded-3xl border border-white/12 bg-white/[0.03] p-4 sm:p-5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">Team Credits</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {teamMembers.map((member) => (
            <div key={member.name} className="rounded-xl border border-white/15 bg-black/35 px-3 py-2.5">
              <p className="text-sm font-semibold text-white">{member.name}</p>
              <p className="mt-0.5 text-xs text-white/65">{member.role}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-white/72">L.R. Tiwari College of Engineering</p>
        <p className="mt-0.5 text-sm text-white/50">© 2026 AI Meeting Agent</p>
      </section>
    </main>
  );
}
