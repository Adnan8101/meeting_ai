"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckSquare, FileText, Link, UserPlus } from "lucide-react";

type FlowStep = {
  id: number;
  title: string;
  subtitle: string;
  detail: string;
  icon: typeof UserPlus;
  progress: number;
  includes: string[];
  howItWorks: string;
};

const flowSteps: FlowStep[] = [
  {
    id: 1,
    title: "Sign Up",
    subtitle: "Create account and verify email",
    detail: "Secure onboarding with account setup and verification.",
    icon: UserPlus,
    progress: 100,
    includes: [
      "User registration",
      "Email verification",
      "Workspace initialization",
    ],
    howItWorks:
      "Users register once, verify email, and instantly unlock dashboard access for analysis workflows.",
  },
  {
    id: 2,
    title: "Connect Tools",
    subtitle: "Integrate with Trello and Jira",
    detail: "Connect delivery systems used by your team.",
    icon: Link,
    progress: 100,
    includes: [
      "Trello token connection",
      "Jira URL, email, token setup",
      "Integration health validation",
    ],
    howItWorks:
      "Integration credentials are saved once, then reused to push action items directly after analysis.",
  },
  {
    id: 3,
    title: "Upload Transcript",
    subtitle: "Paste meeting transcript",
    detail: "Provide transcript text or upload a supported file.",
    icon: FileText,
    progress: 100,
    includes: [
      "Transcript text input",
      "Attachment support (TXT, DOC, DOCX, PDF)",
      "Input cleanup and validation",
    ],
    howItWorks:
      "Input is normalized, validated, and prepared before being sent to Gemini flash models for processing.",
  },
  {
    id: 4,
    title: "Auto-Create Tasks",
    subtitle: "AI creates tasks automatically",
    detail: "Generate summary, actions, and execution plan.",
    icon: CheckSquare,
    progress: 100,
    includes: [
      "Meeting summary and decisions",
      "Action item extraction with priorities",
      "Execution-ready output",
    ],
    howItWorks:
      "AI analyzes context, returns structured output, and prepares actionable results for dashboard and integrations.",
  },
];

export function HowItWorksFlow() {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [isPinned, setIsPinned] = useState(false);

  useEffect(() => {
    if (isPinned) {
      return;
    }

    const interval = setInterval(() => {
      setActiveStep((prev) => (prev % flowSteps.length) + 1);
    }, 4200);

    return () => clearInterval(interval);
  }, [isPinned]);

  const activeIndex = useMemo(
    () => Math.max(0, flowSteps.findIndex((step) => step.id === activeStep)),
    [activeStep]
  );

  const activeData = flowSteps[activeIndex] ?? flowSteps[0];
  const railProgress = (activeIndex / (flowSteps.length - 1)) * 100;

  return (
    <section className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-black p-5 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.24em] text-white/55">Pipeline Timeline</p>
        <button
          type="button"
          onClick={() => setIsPinned((prev) => !prev)}
          className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80 transition hover:border-white/60"
        >
          {isPinned ? "Resume flow" : "Pause flow"}
        </button>
      </div>

      <div className="relative mt-8">
        <div className="pointer-events-none absolute left-0 right-0 top-5 z-0 h-px bg-white/15" />
        <div
          className="pointer-events-none absolute left-0 top-5 z-0 h-px bg-white transition-all duration-700"
          style={{ width: `${railProgress}%` }}
        />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {flowSteps.map((step, index) => {
            const Icon = step.icon;
            const isActive = step.id === activeStep;
            const isComplete = index <= activeIndex;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  setActiveStep(step.id);
                  setIsPinned(true);
                }}
                className={`group relative z-10 rounded-2xl border p-4 text-left transition ${
                  isActive
                    ? "border-white bg-black/80"
                    : "border-white/10 bg-black/85 hover:border-white/35"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold ${
                      isComplete
                        ? "border-white bg-white text-black"
                        : "border-white/30 text-white/70"
                    }`}
                  >
                    {step.id}
                  </span>
                  <Icon className="h-4 w-4 text-white/65" />
                </div>
                <p className="mt-4 text-sm font-medium text-white">{step.title}</p>
                <p className="mt-1 text-xs text-white/60">{step.subtitle}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <article className="rounded-2xl border border-white/15 bg-black/60 p-5">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Active Step</p>
          <h3 className="mt-2 text-2xl font-semibold">{activeData.title}</h3>
          <p className="mt-2 text-sm text-white/70">{activeData.detail}</p>

          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">How It Works</p>
            <p className="mt-2 text-sm leading-6 text-white/80">{activeData.howItWorks}</p>
          </div>

          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between text-xs text-white/75">
              <span>Step Progress</span>
              <span>{activeData.progress}%</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-white/15">
              <div
                className="h-1.5 rounded-full bg-gradient-to-r from-white to-zinc-300 transition-all duration-700"
                style={{ width: `${activeData.progress}%` }}
              />
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-white/15 bg-black/60 p-5">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">What Is Included</p>
          <ul className="mt-3 space-y-2">
            {activeData.includes.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-white/80">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-white/70" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
