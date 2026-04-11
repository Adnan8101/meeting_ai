"use client";

import type { ComponentProps, ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

const team = [
  { name: "Hamza Sayyad", role: "Frontend Developer" },
  { name: "Hasan Shaikh", role: "AI Engineer" },
  { name: "Ujjval Shrivastav", role: "Backend Developer" },
  { name: "Rahul Rathod", role: "Cloud & Database" },
];

export function Footer() {
  return (
    <footer className="relative w-full max-w-6xl mx-auto flex flex-col items-center justify-center rounded-t-[2.5rem] md:rounded-t-[3.5rem] border-t bg-[radial-gradient(35%_128px_at_50%_0%,rgb(255_255_255/8%),transparent)] px-6 py-12 lg:py-16">
      <div className="bg-foreground/20 absolute top-0 right-1/2 left-1/2 h-px w-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full blur" />

      <div className="w-full">
        <AnimatedContainer className="mx-auto max-w-4xl text-center">
          <h3 className="text-xs uppercase tracking-[0.24em] text-white/60">
            Core Team
          </h3>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-left">
            {team.map((member, index) => (
              <AnimatedContainer
                key={member.name}
                delay={0.1 + index * 0.08}
                className="rounded-2xl border border-white/15 bg-white/[0.03] p-4"
              >
                <p className="text-sm font-medium text-white">{member.name}</p>
                <p className="mt-1 text-xs text-white/65">{member.role}</p>
              </AnimatedContainer>
            ))}
          </div>

          <p className="mt-8 text-sm text-white/70">L.R. Tiwari College of Engineering</p>
          <p className="mt-2 text-sm text-white/45">© 2026 AI Meeting Agent</p>
        </AnimatedContainer>
      </div>
    </footer>
  );
}

type ViewAnimationProps = {
  delay?: number;
  className?: ComponentProps<typeof motion.div>["className"];
  children: ReactNode;
};

function AnimatedContainer({
  className,
  delay = 0.1,
  children,
}: ViewAnimationProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <>{children}</>;
  }

  return (
    <motion.div
      initial={{ filter: "blur(4px)", translateY: -8, opacity: 0 }}
      whileInView={{ filter: "blur(0px)", translateY: 0, opacity: 1 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.8 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
