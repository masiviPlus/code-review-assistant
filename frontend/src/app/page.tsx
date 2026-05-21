'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/theme-context';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Scroll-reveal hook                                                 */
/* ------------------------------------------------------------------ */

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    if (prefersReduced) {
      el.style.opacity = '1';
      el.style.transform = 'none';
      return;
    }

    el.style.opacity = '0';
    el.style.transform = 'translateY(10px)';
    el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = '1';
          el.style.transform = 'none';
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function Home() {
  return (
    <div className="min-h-screen">
      <StickyNav />
      <main>
        <HeroSection />
        <WhatItDoesSection />
        <HowItWorksSection />
        <ForWhoSection />
      </main>
      <FooterSection />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sticky nav                                                         */
/* ------------------------------------------------------------------ */

function StickyNav() {
  const { theme, toggle } = useTheme();
  const Icon = theme === 'light' ? Sun : Moon;

  return (
    <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-11 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Code Review Assistant
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/register">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero                                                               */
/* ------------------------------------------------------------------ */

function HeroSection() {
  const ref = useReveal();

  return (
    <section className="px-4 pb-20 pt-24 sm:px-6 sm:pb-28 sm:pt-32">
      <div ref={ref} className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Code Review Assistant
        </h1>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
          Paste your JavaScript, get a structured review in seconds.
          Scores, issues, suggestions — saved so you can track how
          your code improves over time.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Button size="sm" asChild>
            <Link href="/register">Get started</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  What it does — three sections                                      */
/* ------------------------------------------------------------------ */

function WhatItDoesSection() {
  const ref1 = useReveal();
  const ref2 = useReveal();
  const ref3 = useReveal();

  return (
    <section className="border-t border-border">
      {/* 1: Submit and get feedback */}
      <div className="px-4 py-16 sm:px-6 sm:py-24">
        <div ref={ref1} className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <div className="max-w-lg">
            <StepLabel n={1} />
            <h2 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
              Submit code, get structured feedback
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Paste any JavaScript into the editor and submit. The reviewer
              analyses your code against style, best-practice, logic, and
              readability checks — then returns a score out of 100 and a
              list of issues with line numbers and fix suggestions.
            </p>
          </div>
          <ReviewMock />
        </div>
      </div>

      {/* 2: Track progress */}
      <div className="border-t border-border px-4 py-16 sm:px-6 sm:py-24">
        <div ref={ref2} className="mx-auto max-w-5xl">
          <div className="max-w-lg">
            <StepLabel n={2} />
            <h2 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
              Track progress over time
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Every submission is saved. Your dashboard shows a score
              trend chart, an activity heatmap, category averages, and
              the issues that come up most often. You see exactly where
              you&apos;re improving and where you keep making the same mistakes.
            </p>
          </div>
          <DashboardMock />
        </div>
      </div>

      {/* 3: Achievements */}
      <div className="border-t border-border px-4 py-16 sm:px-6 sm:py-24">
        <div ref={ref3} className="mx-auto max-w-5xl">
          <div className="max-w-lg">
            <StepLabel n={3} />
            <h2 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
              Earn achievements as you improve
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Hit milestones — your first submission, a 7-day streak, a
              perfect score — and unlock achievements. Points accumulate
              into levels. It&apos;s lightweight gamification to keep you
              coming back, not a leaderboard.
            </p>
          </div>
          <AchievementsMock />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  How it works                                                       */
/* ------------------------------------------------------------------ */

function HowItWorksSection() {
  const ref = useReveal();

  const steps = [
    'You paste your JavaScript code into the editor.',
    'The reviewer analyses it against style, best-practice, logic, and readability checks.',
    'You get a score out of 100, a breakdown by category, and a list of issues with explanations.',
    'Your submissions are saved so you can see how you improve over time.',
  ];

  return (
    <section className="border-t border-border px-4 py-16 sm:px-6 sm:py-24">
      <div ref={ref} className="mx-auto max-w-2xl">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          How it works
        </h2>
        <ol className="mt-6 space-y-4">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed">
              <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground font-mono text-[11px] font-bold text-background">
                {i + 1}
              </span>
              <span className="text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  For who                                                            */
/* ------------------------------------------------------------------ */

function ForWhoSection() {
  const ref = useReveal();

  const audiences = [
    { who: 'Students learning to program', detail: 'Get the kind of feedback a teaching assistant would give, on every submission, instantly.' },
    { who: 'Small teams without a senior reviewer', detail: 'Catch style and logic issues before they hit the PR, without waiting for a human review cycle.' },
    { who: 'Individuals practising on their own', detail: 'Track your improvement over time with scores, streaks, and achievements.' },
  ];

  return (
    <section className="border-t border-border px-4 py-16 sm:px-6 sm:py-24">
      <div ref={ref} className="mx-auto max-w-2xl">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Built for
        </h2>
        <div className="mt-6 space-y-5">
          {audiences.map((a) => (
            <div key={a.who}>
              <h3 className="text-sm font-medium">{a.who}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {a.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Footer                                                             */
/* ------------------------------------------------------------------ */

function FooterSection() {
  return (
    <footer className="border-t border-border px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span>Code Review Assistant</span>
          <a
            href="https://github.com/masiviPlus/code-review-assistant"
            className="underline-offset-2 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <Link href="/login" className="underline-offset-2 hover:underline">
            Sign in
          </Link>
        </div>
        <span>v0.1.0</span>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/*  Step label                                                         */
/* ------------------------------------------------------------------ */

function StepLabel({ n }: { n: number }) {
  return (
    <span className="inline-flex h-5 items-center rounded-full bg-foreground/5 px-2.5 font-mono text-[11px] font-medium text-muted-foreground">
      0{n}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Mock: code review                                                  */
/* ------------------------------------------------------------------ */

function ReviewMock() {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card text-[12px] leading-snug">
      {/* Mock editor */}
      <div className="border-b border-border bg-card p-3 font-mono">
        <div className="space-y-0.5">
          <Line n={1} code="function getUsers() {" />
          <Line n={2} code={'  let response = fetch("/api/users");'} highlight="warning" />
          <Line n={3} code="  let data = response.json();" />
          <Line n={4} code="  for (var i = 0; i < data.length; i++) {" highlight="error" />
          <Line n={5} code="    console.log(data[i].name);" />
          <Line n={6} code="  }" />
          <Line n={7} code="  return data;" />
          <Line n={8} code="}" />
        </div>
      </div>
      {/* Mock issues */}
      <div className="space-y-0 divide-y divide-border p-0">
        <MockIssue
          severity="error"
          line={4}
          message="Use let or const instead of var"
          suggestion="var is function-scoped. Use let for block scoping."
        />
        <MockIssue
          severity="warning"
          line={2}
          message="fetch() returns a Promise — missing await"
          suggestion="Add await before fetch() and mark the function async."
        />
      </div>
    </div>
  );
}

function Line({ n, code, highlight }: { n: number; code: string; highlight?: 'error' | 'warning' }) {
  return (
    <div
      className={cn(
        'flex',
        highlight === 'error' && 'bg-red-500/10 dark:bg-red-400/10',
        highlight === 'warning' && 'bg-amber-500/10 dark:bg-amber-400/10',
      )}
    >
      <span className="w-6 shrink-0 select-none text-right text-muted-foreground/50">
        {n}
      </span>
      <span className="ml-3 text-foreground/80">{code}</span>
    </div>
  );
}

function MockIssue({
  severity,
  line,
  message,
  suggestion,
}: {
  severity: 'error' | 'warning';
  line: number;
  message: string;
  suggestion: string;
}) {
  return (
    <div className="px-3 py-2.5">
      <div className="flex items-start gap-2">
        <span
          className={cn(
            'mt-0.5 h-2 w-2 shrink-0 rounded-full',
            severity === 'error' ? 'bg-red-500 dark:bg-red-400' : 'bg-amber-500 dark:bg-amber-400',
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-foreground">{message}</span>
            <span className="shrink-0 font-mono text-muted-foreground">L{line}</span>
          </div>
          <p className="mt-1 text-muted-foreground">{suggestion}</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mock: dashboard stats                                              */
/* ------------------------------------------------------------------ */

function DashboardMock() {
  const bars = [
    { label: 'Style', value: 82 },
    { label: 'Best Practices', value: 71 },
    { label: 'Logic', value: 88 },
    { label: 'Readability', value: 76 },
  ];

  return (
    <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-lg">
      {/* Score card */}
      <div className="rounded-md border border-border bg-card p-4">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Latest score
        </div>
        <div className="mt-1 text-3xl font-bold tabular-nums text-green-600 dark:text-green-400">
          82
          <span className="ml-1 text-sm font-normal text-muted-foreground">/ 100</span>
        </div>
      </div>
      {/* Breakdown */}
      <div className="rounded-md border border-border bg-card p-4">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Breakdown
        </div>
        <div className="mt-2 space-y-1.5">
          {bars.map((b) => (
            <div key={b.label}>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">{b.label}</span>
                <span className="tabular-nums text-muted-foreground">{b.value}</span>
              </div>
              <div className="mt-0.5 h-1 w-full rounded-full bg-secondary">
                <div
                  className={cn(
                    'h-full rounded-full',
                    b.value >= 80
                      ? 'bg-green-500 dark:bg-green-400'
                      : 'bg-amber-500 dark:bg-amber-400',
                  )}
                  style={{ width: `${b.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mock: achievements                                                 */
/* ------------------------------------------------------------------ */

function AchievementsMock() {
  const achievements = [
    { letter: 'F', name: 'First Steps', unlocked: true },
    { letter: 'S', name: 'Style Master', unlocked: true },
    { letter: 'C', name: 'Consistent', unlocked: false },
    { letter: '!', name: 'Perfectionist', unlocked: false },
  ];

  return (
    <div className="mt-8 flex gap-3">
      {achievements.map((a) => (
        <div
          key={a.letter}
          className={cn(
            'flex flex-col items-center gap-1.5',
            !a.unlocked && 'opacity-40',
          )}
        >
          <div
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full font-mono text-xs font-bold',
              a.unlocked
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {a.letter}
          </div>
          <span className="text-[10px] text-muted-foreground">{a.name}</span>
        </div>
      ))}
    </div>
  );
}
