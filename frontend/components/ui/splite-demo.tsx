'use client';

import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { SplineScene } from '@/components/ui/splite';
import { Card } from '@/components/ui/card';
import { Spotlight } from '@/components/ui/spotlight';

export function SplineSceneBasic() {
  return (
    <Card className="relative h-[560px] w-full overflow-hidden border border-white/20 bg-black/[0.96] text-white">
      <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="white" />

      <div className="relative z-10 flex h-full flex-col md:flex-row">
        <div className="flex flex-1 flex-col justify-center p-8 md:p-12">
          <p className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/80">
            <Sparkles className="h-3.5 w-3.5" />
            AI Meeting Agent
          </p>
          <h1 className="bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-4xl font-semibold tracking-tight text-transparent md:text-6xl">
            From Meeting to Execution
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-6 text-neutral-300 md:text-base">
            Convert meeting transcripts into actionable plans with AI summaries,
            smart priorities, Trello and Jira sync, and team-ready task boards.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-neutral-200"
            >
              Start Free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 px-5 py-2.5 text-sm text-white transition hover:bg-white/10"
            >
              Watch Workflow
            </Link>
          </div>
        </div>

        <div className="relative flex-1">
          <SplineScene
            scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
            className="h-full w-full"
          />
        </div>
      </div>
    </Card>
  );
}
