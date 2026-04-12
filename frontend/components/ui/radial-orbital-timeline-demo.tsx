"use client";

import {
  Bell,
  Brain,
  CheckSquare,
  Clock,
  Lock,
  Trello,
  Users,
} from "lucide-react";
import RadialOrbitalTimeline from "@/components/ui/radial-orbital-timeline";

const timelineData = [
  {
    id: 1,
    title: "AI-Powered Analysis",
    date: "Planning",
    content:
      "Advanced LLM analyzes meeting transcripts and automatically identifies action items.",
    category: "Planning",
    icon: Brain,
    relatedIds: [2],
    status: "completed" as const,
    energy: 100,
    includes: [
      "Meeting summary with priorities",
      "Action item extraction with owners",
      "Execution readiness score",
    ],
    howItWorks:
      "Upload transcript -> AI identifies decisions and tasks -> output becomes an executable plan.",
    progressLabel: "Analysis Accuracy",
  },
  {
    id: 2,
    title: "Trello Integration",
    date: "Execution",
    content:
      "Seamlessly create cards, lists, and boards on Trello directly from meetings.",
    category: "Execution",
    icon: Trello,
    relatedIds: [1, 3],
    status: "completed" as const,
    energy: 92,
    includes: [
      "Auto-card generation from action items",
      "Board/list mapping by team workflow",
      "Due date and assignee sync",
    ],
    howItWorks:
      "Connect Trello once -> map workspace board -> tasks are pushed after each meeting.",
    progressLabel: "Automation Coverage",
  },
  {
    id: 3,
    title: "Jira Integration",
    date: "Execution",
    content:
      "Create issues, epics, and stories in Jira automatically from meeting outcomes.",
    category: "Development",
    icon: CheckSquare,
    relatedIds: [2, 4],
    status: "in-progress" as const,
    energy: 84,
    includes: [
      "Issue type detection (Story, Task, Epic)",
      "Sprint-aware ticket creation",
      "Linked acceptance criteria",
    ],
    howItWorks:
      "The system maps AI-extracted tasks to Jira fields, validates required fields, then creates tickets.",
    progressLabel: "Ticket Success Rate",
  },
  {
    id: 4,
    title: "Team Collaboration",
    date: "Alignment",
    content:
      "Create teams, assign tasks, and collaborate seamlessly after every meeting.",
    category: "Testing",
    icon: Users,
    relatedIds: [3, 5],
    status: "in-progress" as const,
    energy: 78,
    includes: [
      "Team spaces and role-based assignment",
      "Task ownership and deadlines",
      "Cross-functional execution boards",
    ],
    howItWorks:
      "Once tasks are generated, members are auto-suggested by skill history and workload.",
    progressLabel: "Collaboration Health",
  },
  {
    id: 5,
    title: "Email Notifications",
    date: "Release",
    content: "Get instant notifications for activities, integrations, and updates.",
    category: "Release",
    icon: Bell,
    relatedIds: [4, 6],
    status: "pending" as const,
    energy: 70,
    includes: [
      "Instant digest after every meeting",
      "Task changes and due reminders",
      "Integration failure alerts",
    ],
    howItWorks:
      "Event triggers from Trello/Jira updates are aggregated and delivered as smart notifications.",
    progressLabel: "Delivery Reliability",
  },
  {
    id: 6,
    title: "Secure & Private",
    date: "Release",
    content:
      "Enterprise-grade security with PostgreSQL, encryption, and authentication.",
    category: "Release",
    icon: Lock,
    relatedIds: [5],
    status: "pending" as const,
    energy: 88,
    includes: [
      "Encrypted storage for transcripts",
      "Authenticated API access",
      "Audit-ready activity logs",
    ],
    howItWorks:
      "Security layers protect data at rest and in transit, while authenticated workflows enforce access control.",
    progressLabel: "Security Readiness",
  },
];

export function RadialOrbitalTimelineDemo() {
  return <RadialOrbitalTimeline timelineData={timelineData} />;
}
