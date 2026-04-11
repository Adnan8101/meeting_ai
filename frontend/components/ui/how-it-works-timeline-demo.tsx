"use client";

import { CheckSquare, FileText, Link, UserPlus } from "lucide-react";
import RadialOrbitalTimeline, {
  type TimelineItem,
} from "@/components/ui/radial-orbital-timeline";

const howItWorksTimelineData: TimelineItem[] = [
  {
    id: 1,
    step: 1,
    totalSteps: 4,
    title: "Sign Up",
    date: "Step 1",
    content: "Create account and verify email.",
    category: "Onboarding",
    icon: UserPlus,
    relatedIds: [2],
    status: "completed",
    energy: 100,
    includes: [
      "Secure account creation",
      "Email verification in one flow",
      "Instant workspace provisioning",
    ],
    howItWorks:
      "A user registers, verifies email, and the platform unlocks team-ready meeting automation.",
    progressLabel: "Step Completion",
  },
  {
    id: 2,
    step: 2,
    totalSteps: 4,
    title: "Connect Tools",
    date: "Step 2",
    content: "Integrate with Trello and Jira.",
    category: "Integrations",
    icon: Link,
    relatedIds: [1, 3],
    status: "completed",
    energy: 100,
    includes: [
      "Trello board and list mapping",
      "Jira project and issue-type mapping",
      "Token validation and permission checks",
    ],
    howItWorks:
      "You connect integrations once, and mapped fields are reused for every future meeting execution.",
    progressLabel: "Integration Readiness",
  },
  {
    id: 3,
    step: 3,
    totalSteps: 4,
    title: "Upload Transcript",
    date: "Step 3",
    content: "Paste meeting transcript.",
    category: "Input",
    icon: FileText,
    relatedIds: [2, 4],
    status: "completed",
    energy: 100,
    includes: [
      "Transcript parsing and normalization",
      "Decision and task extraction",
      "Priority and ownership detection",
    ],
    howItWorks:
      "The transcript is parsed by AI to produce a clean summary and execution-ready action items.",
    progressLabel: "Extraction Quality",
  },
  {
    id: 4,
    step: 4,
    totalSteps: 4,
    title: "Auto-Create Tasks",
    date: "Step 4",
    content: "AI creates tasks automatically.",
    category: "Execution",
    icon: CheckSquare,
    relatedIds: [3],
    status: "completed",
    energy: 100,
    includes: [
      "Auto creation in Trello and Jira",
      "Owner, due date, and context included",
      "Execution notifications sent to team",
    ],
    howItWorks:
      "Generated items are posted directly to your connected tools with complete context and traceability.",
    progressLabel: "Pipeline Success",
  },
];

export function HowItWorksTimelineDemo() {
  return (
    <RadialOrbitalTimeline
      timelineData={howItWorksTimelineData}
      rotationStep={0.12}
      rotationIntervalMs={90}
      heightClassName="h-[40rem] md:h-[46rem]"
    />
  );
}
