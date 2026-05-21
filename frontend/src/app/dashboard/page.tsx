'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  FileCode,
  TrendingUp,
  Flame,
  Star,
  ArrowRight,
  Code,
  Trophy,
} from 'lucide-react';

import { apiWithAuth } from '@/lib/auth';
import { useUser } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AchievementStatus {
  code: string;
  name: string;
  description: string;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: { current: number; target: number };
}

interface SubmissionStats {
  categoryAverages: {
    style: number;
    bestPractices: number;
    logic: number;
    readability: number;
  } | null;
  topIssues: {
    category: string;
    severity: string;
    count: number;
  }[];
}

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
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (days.has(key)) {
      streak++;
    } else if (i === 0) {
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
      index: i,
      score: s.scoreOverall!,
      label: new Date(s.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
    }));
}

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

          {/* Category averages + top issues side by side on lg, stacked on sm */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 lg:gap-3">
            {/* Category breakdown */}
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

            {/* Most common issues */}
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

/* ------------------------------------------------------------------ */
/*  Achievements card                                                  */
/* ------------------------------------------------------------------ */

function AchievementsCard({ achievements }: { achievements: AchievementStatus[] }) {
  const unlocked = achievements.filter((a) => a.unlocked);
  const total = achievements.length;

  // 3 most recently unlocked, sorted by unlockedAt descending
  const recent = [...unlocked]
    .sort((a, b) => {
      if (!a.unlockedAt || !b.unlockedAt) return 0;
      return new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime();
    })
    .slice(0, 3);

  return (
    <div className="mb-8 rounded-md border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Trophy className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">Achievements</span>
        </div>
        <Link
          href="/achievements"
          className="text-xs font-medium text-primary hover:underline"
        >
          {unlocked.length} / {total} unlocked
        </Link>
      </div>

      <div className="px-4 py-3">
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No achievements yet. Keep submitting!
          </p>
        ) : (
          <div className="space-y-2">
            {recent.map((a) => (
              <div key={a.code} className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  {a.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight">{a.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.description}
                  </p>
                </div>
                {a.unlockedAt && (
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {new Date(a.unlockedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Activity heatmap (last 90 days, GitHub-style)                      */
/* ------------------------------------------------------------------ */

function ActivityHeatmap({ submissions }: { submissions: Submission[] }) {
  const DAYS = 90;
  const CELL = 11;
  const GAP = 2;

  // Build a map of date → submission count
  const countMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of submissions) {
      const d = new Date(s.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [submissions]);

  // Generate grid: 90 days ending today, columns = weeks, rows = days of week
  const today = new Date();
  const cells: { date: string; count: number; col: number; row: number }[] = [];

  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - (DAYS - 1));

  for (let i = 0; i < DAYS; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dayOfWeek = d.getDay(); // 0=Sun
    const daysSinceStart = i;
    const col = Math.floor((daysSinceStart + startDate.getDay()) / 7);
    const row = dayOfWeek;
    cells.push({ date: key, count: countMap.get(key) ?? 0, col, row });
  }

  const maxCol = Math.max(...cells.map((c) => c.col));
  const width = (maxCol + 1) * (CELL + GAP);
  const height = 7 * (CELL + GAP);

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} className="block">
        {cells.map((cell) => (
          <rect
            key={cell.date}
            x={cell.col * (CELL + GAP)}
            y={cell.row * (CELL + GAP)}
            width={CELL}
            height={CELL}
            rx={2}
            className={cn(
              cell.count === 0
                ? 'fill-secondary'
                : cell.count === 1
                  ? 'fill-primary/30'
                  : cell.count === 2
                    ? 'fill-primary/55'
                    : 'fill-primary/85',
            )}
          >
            <title>{`${cell.date}: ${cell.count} submission${cell.count !== 1 ? 's' : ''}`}</title>
          </rect>
        ))}
      </svg>
      {/* Legend */}
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
        <span>Less</span>
        <span className="inline-block h-[9px] w-[9px] rounded-[2px] bg-secondary" />
        <span className="inline-block h-[9px] w-[9px] rounded-[2px] bg-primary/30" />
        <span className="inline-block h-[9px] w-[9px] rounded-[2px] bg-primary/55" />
        <span className="inline-block h-[9px] w-[9px] rounded-[2px] bg-primary/85" />
        <span>More</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Category breakdown bar chart                                       */
/* ------------------------------------------------------------------ */

const CATEGORY_LABELS: Record<string, string> = {
  style: 'Style',
  bestPractices: 'Best Practices',
  logic: 'Logic',
  readability: 'Readability',
};

function barFill(score: number): string {
  if (score >= 80) return 'hsl(142, 71%, 45%)';
  if (score >= 50) return 'hsl(38, 92%, 50%)';
  return 'hsl(0, 84%, 60%)';
}

function CategoryBreakdown({
  averages,
}: {
  averages: { style: number; bestPractices: number; logic: number; readability: number };
}) {
  const data = Object.entries(averages).map(([key, value]) => ({
    category: CATEGORY_LABELS[key] ?? key,
    score: value,
  }));

  return (
    <div className="h-36">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            stroke="hsl(var(--muted-foreground))"
          />
          <YAxis
            type="category"
            dataKey="category"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={90}
            stroke="hsl(var(--muted-foreground))"
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 6,
              border: '1px solid hsl(var(--border))',
              boxShadow: 'none',
            }}
            formatter={(value) => [`${value}`, 'Avg']}
          />
          <Bar dataKey="score" radius={[0, 3, 3, 0]} barSize={14}>
            {data.map((entry, i) => (
              <Cell key={i} fill={barFill(entry.score)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Most common issues panel                                           */
/* ------------------------------------------------------------------ */

const ISSUE_CATEGORY_LABELS: Record<string, string> = {
  style: 'Style',
  best_practice: 'Best practice',
  logic: 'Logic',
  readability: 'Readability',
};

const SEVERITY_DOT: Record<string, string> = {
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
};

function TopIssuesPanel({
  issues,
}: {
  issues: { category: string; severity: string; count: number }[];
}) {
  const maxCount = Math.max(...issues.map((i) => i.count), 1);

  return (
    <div className="divide-y divide-border">
      {issues.map((issue, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-2.5">
          <span
            className={cn(
              'h-2 w-2 shrink-0 rounded-full',
              SEVERITY_DOT[issue.severity] ?? 'bg-muted-foreground',
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium">
                {ISSUE_CATEGORY_LABELS[issue.category] ?? issue.category}
              </span>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {issue.count}
              </span>
            </div>
            <div className="mt-1 h-1 w-full rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-muted-foreground/30 transition-all"
                style={{ width: `${(issue.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
