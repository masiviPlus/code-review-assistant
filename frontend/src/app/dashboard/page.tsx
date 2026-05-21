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
import type { Submission, AchievementStatus, SubmissionStats } from '@/lib/types';
import { scoreColor } from '@/lib/score-utils';
import {
  computeAvgScore,
  computeStreak,
  topIssueCategory,
  buildChartData,
} from '@/lib/submission-utils';
import { StatCard } from '@/components/stat-card';
import { AchievementsCard } from '@/components/achievements-card';
import { ActivityHeatmap } from '@/components/activity-heatmap';
import { CategoryBreakdown } from '@/components/category-breakdown';
import { TopIssuesPanel } from '@/components/top-issues-panel';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const FETCH_LIMIT = 50;

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const { user } = useUser();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [achievements, setAchievements] = useState<AchievementStatus[]>([]);
  const [stats, setStats] = useState<SubmissionStats | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [subRes, achRes, statsRes] = await Promise.all([
        apiWithAuth<Submission[]>(`/api/submissions?limit=${FETCH_LIMIT}`),
        apiWithAuth<AchievementStatus[]>('/api/achievements'),
        apiWithAuth<SubmissionStats>('/api/submissions/stats'),
      ]);
      if (subRes.ok) {
        setSubmissions(subRes.data);
        setHasMore(subRes.data.length === FETCH_LIMIT);
      } else {
        setError(subRes.error.message);
      }
      if (achRes.ok) {
        setAchievements(achRes.data);
      }
      if (statsRes.ok) {
        setStats(statsRes.data);
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
      <div className="flex h-[calc(100vh-2.75rem)] items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[calc(100vh-2.75rem)] flex-col items-center justify-center gap-4">
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
      <div className="flex h-[calc(100vh-2.75rem)] flex-col items-center justify-center px-4">
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

  const submissionCountLabel = hasMore
    ? `${FETCH_LIMIT}+`
    : String(submissions.length);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* ---- Stats row ---- */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<FileCode className="h-4 w-4" />}
          label="Submissions"
          value={submissionCountLabel}
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

      {/* ---- Achievements card ---- */}
      {achievements.length > 0 && (
        <AchievementsCard achievements={achievements} />
      )}

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
                  tickFormatter={(i: number) => chartData[i]?.label ?? ''}
                  interval="preserveStartEnd"
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
                  formatter={(value) => [`${value}`, 'Score']}
                  labelFormatter={(i) => chartData[Number(i)]?.label ?? ''}
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

      {/* ---- Activity heatmap + analytics row ---- */}
      {submissions.length > 0 && (
        <div className="mb-8 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {/* Heatmap */}
          <div>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Activity (90 days)
            </h2>
            <div className="rounded-md border border-border bg-card p-3">
              <ActivityHeatmap submissions={submissions} />
            </div>
          </div>

          {/* Category averages + top issues */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 lg:gap-3">
            {stats?.categoryAverages && (
              <div>
                <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Avg by category
                </h2>
                <div className="rounded-md border border-border bg-card p-3">
                  <CategoryBreakdown averages={stats.categoryAverages} />
                </div>
              </div>
            )}

            {stats && stats.topIssues.length > 0 && (
              <div>
                <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Most common issues
                </h2>
                <div className="rounded-md border border-border bg-card">
                  <TopIssuesPanel issues={stats.topIssues} />
                </div>
              </div>
            )}
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
