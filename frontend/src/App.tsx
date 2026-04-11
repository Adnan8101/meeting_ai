import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  BookOpen,
  ChartGantt,
  Home,
  LayoutDashboard,
  LoaderCircle,
  PlugZap,
  Rocket,
} from 'lucide-react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { MenuItem } from '@/components/ui/glow-menu';
import CloudWatchForm from '@/components/ui/cloud-watch-form';
import DocumentationHub from '@/components/ui/documentation-hub';
import { Footer } from '@/components/ui/footer-section';
import { MenuBar } from '@/components/ui/glow-menu';
import { HowItWorksFlow } from '@/components/ui/how-it-works-flow';
import { RadialOrbitalTimelineDemo } from '@/components/ui/radial-orbital-timeline-demo';
import { SplineSceneBasic } from '@/components/ui/splite-demo';
import AssistantChatWidget from '@/components/ui/AssistantChatWidget';
import AnalysePage from './pages/AnalysePage';
import DashboardWorkspacePage from './pages/DashboardPage';
import IntegrationsPage from './pages/IntegrationsPage';

function Shell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [authReady, setAuthReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const readAuthStatus = async () => {
      try {
        const response = await fetch('/api/auth/status', {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        const payload = await response.json();
        if (isMounted) {
          setIsAuthenticated(Boolean(payload?.authenticated));
        }
      } catch {
        if (isMounted) {
          setIsAuthenticated(false);
        }
      } finally {
        if (isMounted) {
          setAuthReady(true);
        }
      }
    };

    readAuthStatus();
    return () => {
      isMounted = false;
    };
  }, [location.pathname]);

  const guestMenuItems: MenuItem[] = [
    {
      icon: Home,
      label: 'Home',
      href: '/',
      gradient:
        'radial-gradient(circle, rgba(59,130,246,0.25) 0%, rgba(37,99,235,0.07) 55%, rgba(29,78,216,0) 100%)',
      iconColor: 'text-blue-300',
    },
    {
      icon: BookOpen,
      label: 'Docs',
      href: '/docs',
      gradient:
        'radial-gradient(circle, rgba(216,180,254,0.22) 0%, rgba(192,132,252,0.08) 55%, rgba(147,51,234,0) 100%)',
      iconColor: 'text-violet-300',
    },
  ];

  const memberMenuItems: MenuItem[] = [
    guestMenuItems[0],
    {
      icon: LayoutDashboard,
      label: 'Dashboard',
      href: '/dashboard',
      gradient:
        'radial-gradient(circle, rgba(125,211,252,0.25) 0%, rgba(56,189,248,0.08) 55%, rgba(14,165,233,0) 100%)',
      iconColor: 'text-sky-300',
    },
    {
      icon: ChartGantt,
      label: 'Analyse',
      href: '/analyse',
      gradient:
        'radial-gradient(circle, rgba(251,191,36,0.25) 0%, rgba(245,158,11,0.08) 55%, rgba(217,119,6,0) 100%)',
      iconColor: 'text-amber-300',
    },
    {
      icon: PlugZap,
      label: 'Integrations',
      href: '/integrations',
      gradient:
        'radial-gradient(circle, rgba(34,197,94,0.25) 0%, rgba(22,163,74,0.08) 55%, rgba(21,128,61,0) 100%)',
      iconColor: 'text-emerald-300',
    },
    guestMenuItems[1],
  ];

  const menuItems = isAuthenticated ? memberMenuItems : guestMenuItems;

  const activeLabel =
    menuItems.find((item) =>
      item.href === '/'
        ? location.pathname === '/' || location.pathname === '/home'
        : location.pathname.startsWith(item.href)
    )?.label || 'Home';

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
    } catch {
      // Best effort logout.
    } finally {
      setIsAuthenticated(false);
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/70 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <Link to="/" className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.04] px-4 py-2 text-sm font-medium tracking-[0.14em] text-white">
            <Rocket className="h-4 w-4" />
            AI MEETING AGENT
          </Link>
          <div className="hidden md:block">
            {authReady ? (
              <MenuBar
                items={menuItems}
                activeItem={activeLabel}
                onItemClick={(item) => navigate(item.href)}
              />
            ) : (
              <div className="h-11 w-[340px] animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
            )}
          </div>
          <nav className="flex items-center gap-2 text-xs">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-full border border-white/25 px-4 py-1.5 font-medium text-white/90 transition hover:border-white/60 hover:text-white"
              >
                Sign Out
              </button>
            ) : (
              <Link
                to="/login"
                className="rounded-full border border-white bg-white px-4 py-1.5 font-medium text-black transition hover:bg-zinc-200"
              >
                Sign In
              </Link>
            )}
          </nav>
        </div>
      </header>
      {children}
      <AssistantChatWidget visible={Boolean(authReady && isAuthenticated)} />
    </div>
  );
}

function MarketingPage() {
  return (
    <>
      <main>
        <section className="mx-auto max-w-6xl px-6 pt-12 md:pt-16">
          <SplineSceneBasic />
        </section>

        <section className="border-y border-white/10 bg-white/[0.02] py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-4xl font-semibold tracking-tight md:text-6xl">How It Works</h2>
            <p className="mt-4 max-w-2xl text-white/70">Get started in minutes and transform your workflow.</p>
            <div className="mt-8">
              <HowItWorksFlow />
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto mb-8 max-w-6xl px-6">
            <h2 className="text-4xl font-semibold tracking-tight md:text-6xl">Execution Timeline</h2>
            <p className="mt-4 max-w-3xl text-white/70">
              Visualize the full execution lifecycle from planning to release with a connected orbital timeline.
            </p>
          </div>
          <RadialOrbitalTimelineDemo />
        </section>

        <section className="mx-auto max-w-6xl px-6 py-8">
          <div className="rounded-3xl border border-white/10 bg-[linear-gradient(165deg,rgba(20,20,24,0.8),rgba(10,10,12,0.95))] p-8 md:p-12">
            <div className="grid gap-8 md:grid-cols-[1.3fr_1fr] md:items-end">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">Launch Pad</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">Move From Meeting To Momentum</h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 md:text-base">
                  Keep it simple: capture context, generate tasks, and push execution forward without process friction.
                </p>

                <div className="mt-8 rounded-2xl border border-white/12 bg-black/30 p-4">
                  <div className="relative">
                    <div className="h-1 rounded-full bg-white/12" />
                    <div className="absolute inset-y-0 left-0 w-[78%] rounded-full bg-gradient-to-r from-zinc-100 via-zinc-300 to-sky-300/70" />
                  </div>
                  <div className="mt-3 grid grid-cols-4 text-[11px] text-white/65">
                    <span>Capture</span>
                    <span>Analyze</span>
                    <span>Assign</span>
                    <span>Deliver</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 rounded-2xl border border-white/12 bg-black/35 p-4">
                <p className="text-sm text-white/75">Start in under 2 minutes</p>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
                >
                  <Rocket className="h-4 w-4" />
                  Getting Started
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center rounded-xl border border-white/20 px-5 py-3 text-sm font-medium text-white transition hover:border-white/50 hover:bg-white/[0.05]"
                >
                  Create Account
                </Link>
              </div>
            </div>
          </div>
        </section>

      </main>

      <div className="border-t border-white/10 bg-black px-6 pb-0 pt-12">
        <Footer />
      </div>
    </>
  );
}

function LoginPage() {
  return <CloudWatchForm mode="login" action="/login" />;
}

function RegisterPage() {
  return <CloudWatchForm mode="register" action="/register" />;
}

function ForgotPasswordPage() {
  return <CloudWatchForm mode="forgot" action="/forget-password" />;
}

function VerifyEmailPage() {
  const params = useParams();
  const email = params.email || '';
  return (
    <AuthCard
      title="Verify Email"
      subtitle={email ? `Enter OTP for ${email}` : 'Enter OTP sent to your email'}
      action={`/verify_email/${encodeURIComponent(email)}`}
    >
      <input name="otp" placeholder="Verification code" className={inputClass} required />
      <button type="submit" className={buttonClass}>
        Verify Email
      </button>
      <Link to="/login" className="text-sm text-white/80 underline underline-offset-4">
        Back to login
      </Link>
    </AuthCard>
  );
}

function VerifyResetCodePage() {
  const params = useParams();
  const email = params.email || '';

  return (
    <AuthCard
      title="Verify Reset Code"
      subtitle="Verify OTP and choose a new password"
      action={`/verify_reset_code/${encodeURIComponent(email)}`}
    >
      <input name="code" placeholder="Verification code" className={inputClass} required />
      <input
        name="new_password"
        type="password"
        placeholder="New password"
        className={inputClass}
        required
      />
      <input
        name="confirm_password"
        type="password"
        placeholder="Confirm new password"
        className={inputClass}
        required
      />
      <button type="submit" className={buttonClass}>
        Update Password
      </button>
      <Link to="/login" className="text-sm text-white/80 underline underline-offset-4">
        Back to login
      </Link>
    </AuthCard>
  );
}

function DashboardPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <section className="rounded-3xl border border-white/15 bg-white/[0.03] p-8 md:p-10">
        <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">Meeting Transcript Analyzer</h1>
        <p className="mt-3 text-white/70">
          Add meeting text and an optional attachment, then run AI analysis.
        </p>
        <form className="mt-6 grid gap-4" action="/analyse" method="post" encType="multipart/form-data">
          <label className="grid gap-2 text-sm text-white/75">
            Meeting text
            <textarea
              name="transcript"
              className="min-h-52 rounded-2xl border border-white/20 bg-black px-4 py-4 text-sm text-white placeholder:text-white/35"
              placeholder="Paste meeting transcript here..."
              required
            />
          </label>

          <label className="grid gap-2 text-sm text-white/75">
            Attachment (TXT, DOC, DOCX, PDF)
            <input
              name="file"
              type="file"
              accept=".txt,.doc,.docx,.pdf"
              className="rounded-xl border border-white/20 bg-black px-4 py-3 text-white file:mr-4 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-black"
            />
          </label>

          <button type="submit" className={buttonClass}>
            Analyze
          </button>
        </form>
      </section>
    </main>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/status', {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        const payload = await response.json();
        if (!isMounted) {
          return;
        }
        setAuthenticated(Boolean(payload?.authenticated));
      } catch {
        if (isMounted) {
          setAuthenticated(false);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-72px)] max-w-6xl items-center justify-center px-6 py-12">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm text-white/80">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Checking access...
        </div>
      </main>
    );
  }

  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function StaticPage({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <main className="mx-auto max-w-6xl px-6 py-20">
      <section className="rounded-3xl border border-white/15 bg-white/[0.03] p-10">
        <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">{title}</h1>
        <p className="mt-4 text-white/70">{subtitle}</p>
        <p className="mt-2 text-white/55">
          UI is served by React JSX frontend and business logic continues in Python Flask APIs.
        </p>
      </section>
    </main>
  );
}

function AuthCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-72px)] max-w-6xl items-center px-6 py-12">
      <section className="mx-auto w-full max-w-xl rounded-3xl border border-white/20 bg-white/[0.03] p-8 md:p-10">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-white/70">{subtitle}</p>
        <form action={action} method="post" className="mt-6 grid gap-4">
          {children}
        </form>
      </section>
    </main>
  );
}

const inputClass =
  'rounded-xl border border-white/20 bg-black px-4 py-3 text-white placeholder:text-white/35 focus:outline-none focus:ring-1 focus:ring-white/50';
const buttonClass =
  'rounded-xl border border-white bg-white px-4 py-2.5 font-medium text-black transition hover:bg-zinc-200';

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Shell>
        <Routes>
          <Route path="/" element={<MarketingPage />} />
          <Route path="/home" element={<MarketingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forget-password" element={<ForgotPasswordPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/forgot_password" element={<ForgotPasswordPage />} />
          <Route path="/verify_email/:email" element={<VerifyEmailPage />} />
          <Route path="/verify_reset_code" element={<VerifyResetCodePage />} />
          <Route path="/verify_reset_code/:email" element={<VerifyResetCodePage />} />
          <Route path="/dashboard" element={<RequireAuth><DashboardWorkspacePage /></RequireAuth>} />
          <Route path="/analyse" element={<RequireAuth><AnalysePage /></RequireAuth>} />
          <Route path="/analyze" element={<RequireAuth><AnalysePage /></RequireAuth>} />
          <Route path="/team" element={<RequireAuth><StaticPage title="Team Collaboration" subtitle="Create teams, invite members, and assign owners." /></RequireAuth>} />
          <Route path="/integrations" element={<RequireAuth><IntegrationsPage /></RequireAuth>} />
          <Route path="/trello/connect" element={<RequireAuth><Navigate to="/integrations" replace /></RequireAuth>} />
          <Route path="/trello/save_token" element={<RequireAuth><Navigate to="/integrations" replace /></RequireAuth>} />
          <Route path="/jira/connect" element={<RequireAuth><Navigate to="/integrations" replace /></RequireAuth>} />
          <Route path="/docs" element={<DocumentationHub />} />
          <Route path="*" element={<MarketingPage />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
}
