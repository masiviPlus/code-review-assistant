'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  FileCode,
  TrendingUp,
  Flame,
  Star,
  ArrowRight,
  Code,
} from 'lucide-react';

import { apiWithAuth } from '@/lib/auth';
import { useUser } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Submission {
  _id: string;
  code: string;
  language: string;
  status: string;
  scoreOverall?: number;
  scoreBreakdown?: {
    style: number;
    bestPractices: number;
    logic: number;
    readability: number;
  };
  summary?: string;
  createdAt: string;
}

/* The GET /api/submissions response has a non-standard envelope:
   { ok, data: Submission[], pagination: { nextCursor } }
   The pagination field sits outside `data`, but our api client
   only returns the parsed JSON body, so we type `data` as the
   array and ignore pagination for the dashboard. */

/* ------------------------------------------------------------------ */
/*  Stat helpers                                                       */
/* ------------------------------------------------------------------ */

function computeAvgScore(submissions: Submission[]): number | null {
  const scored = submissions
    .filter((s) => s.status === 'complete' && s.scoreOverall != null)
    .slice(0, 10);
  if (scored.length === 0) return null;
  const sum = scored.reduce((acc, s) => acc + s.scoreOverall!, 0);
  return Math.round(sum / scored.length);
}

function computeStreak(submissions: Submission[]): number {
  if (submissions.length === 0) return 0;

  const days = new Set(
    submissions.map((s) => {
      const d = new Date(s.createdAt);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }),
  );

  let streak = 0;
  const now = new Date();
  // Start from today, walk backwards
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (days.has(key)) {
      streak++;
    } else if (i === 0) {
      // Today has no submission — that's OK, still check yesterday
      continue;
    } else {
      break;
    }
  }
  return streak;
}

function topIssueCategory(submission: Submission): string | null {
  if (!submission.scoreBreakdown) return null;
  const { style, bestPractices, logic, readability } = submission.scoreBreakdown;
  const cats: [string, number][] = [
    ['Style', style],
    ['Best practices', bestPractices],
    ['Logic', logic],
    ['Readability', readability],
  ];
  cats.sort((a, b) => a[1] - b[1]);
  return cats[0][1] < 80 ? cats[0][0] : null;
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-red-600';
}

/* ------------------------------------------------------------------ */
/*  Chart data                                                         */
/* ------------------------------------------------------------------ */

function buildChartData(submissions: Submission[]) {
  return submissions
    .filter((s) => s.status === 'complete' && s.scoreOverall != null)
    .slice(0, 20)
    .reverse()
    .map((s, i) => ({
      index: i + 1,
      score: s.scoreOverall!,
      date: new Date(s.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
    }));
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const { user } = useUser();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await apiWithAuth<Submission[]>(
        '/api/submissions?limit=50',
      );
      if (res.ok) {
        setSubmissions(res.data);
      } else {
        setError(res.error.message);
      }
      setLoading(false);
    })();
  }, []);

  const avgScore = useMemo(() => computeAvgScore(submissions), [submissions]);
  const streak = useMemo(() => computeStreak(submissions), [submissions]);
  const chartData = useMemo(() => buildChartData(submissions), [submissions]);
  const recent = submissions.slice(0, 10);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/submit">Go to editor</Link>
        </Button>
      </div>
    );
  }

  /* ---- Empty state ---- */
  if (submissions.length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center px-4">
        <Code className="mb-4 h-10 w-10 text-muted-foreground/50" />
        <h1 className="text-lg font-semibold tracking-tight">
          No submissions yet
        </h1>
        <p className="mt-2 max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
          Submit JavaScript code for automated review. You&apos;ll get a quality
          score, category breakdown, and actionable suggestions for every
          submission.
        </p>
        <Button className="mt-6" asChild>
          <Link href="/submit">Submit your first review</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* ---- Header ---- */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
          {user && (
            <p className="text-sm text-muted-foreground">{user.displayName}</p>
          )}
        </div>
        <Button size="sm" asChild>
          <Link href="/submit">New submission</Link>
        </Button>
      </div>

      {/* ---- Stats row ---- */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<FileCode className="h-4 w-4" />}
          label="Submissions"
          value={String(submissions.length)}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Avg score (last 10)"
          value={avgScore != null ? String(avgScore) : '—'}
          valueClass={avgScore != null ? scoreColor(avgScore) : undefined}
        />
        <StatCard
          icon={<Flame className="h-4 w-4" />}
          label="Day streak"
          value={String(streak)}
        />
        <StatCard
          icon={<Star className="h-4 w-4" />}
          label="Total points"
          value={user?.totalPoints != null ? String(user.totalPoints) : '—'}
        />
      </div>

      {/* ---- Score chart ---- */}
      {chartData.length >= 3 && (
        <div className="mb-8">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Score trend
          </h2>
          <div className="h-48 w-full rounded-md border border-border bg-card p-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis
                  dataKey="index"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(i) => {
                    const point = chartData[i - 1];
                    return point ? point.date : '';
                  }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 6,
                    border: '1px solid hsl(var(--border))',
                    boxShadow: 'none',
                  }}
                  labelFormatter={(i) => {
                    const point = chartData[Number(i) - 1];
                    return point ? point.date : '';
                  }}
                  formatter={(value) => [`${value}`, 'Score']}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="hsl(221, 83%, 53%)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'hsl(221, 83%, 53%)' }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ---- Recent submissions ---- */}
      <div>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Recent submissions
        </h2>
        <div className="rounded-md border border-border bg-card">
          {/* Table header */}
          <div className="hidden border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[1fr_80px_100px_120px_28px]">
            <span>Date</span>
            <span className="text-right">Score</span>
            <span>Language</span>
            <span>Top issue</span>
            <span />
          </div>

          {recent.map((sub) => {
            const topCat = topIssueCategory(sub);
            return (
              <Link
                key={sub._id}
                href={`/submissions/${sub._id}`}
                className="group flex items-center gap-4 border-b border-border px-4 py-3 text-sm transition-colors last:border-b-0 hover:bg-accent/50 sm:grid sm:grid-cols-[1fr_80px_100px_120px_28px]"
              >
                {/* Date */}
                <span className="text-muted-foreground">
                  {new Date(sub.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>

                {/* Score */}
                <span
                  className={cn(
                    'text-right font-mono font-medium tabular-nums',
                    sub.scoreOverall != null
                      ? scoreColor(sub.scoreOverall)
                      : 'text-muted-foreground',
                  )}
                >
                  {sub.status === 'complete'
                    ? sub.scoreOverall
                    : sub.status === 'failed'
                      ? '—'
                      : '…'}
                </span>

                {/* Language */}
                <span className="hidden text-xs text-muted-foreground sm:block">
                  {sub.language}
                </span>

                {/* Top issue category */}
                <span className="hidden text-xs text-muted-foreground sm:block">
                  {topCat ?? '—'}
                </span>

                {/* Arrow */}
                <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 sm:ml-0" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat card                                                          */
/* ------------------------------------------------------------------ */

function StatCard({
  icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card px-4 py-3">
      <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <span
        className={cn(
          'text-xl font-semibold tabular-nums tracking-tight',
          valueClass,
        )}
      >
        {value}
      </span>
    </div>
  );
}
