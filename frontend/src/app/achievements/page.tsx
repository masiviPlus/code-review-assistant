'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { apiWithAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { AchievementStatus } from '@/lib/types';
import { ProgressBar } from '@/components/progress-bar';

/* ------------------------------------------------------------------ */
/*  Badge icon mapping                                                 */
/* ------------------------------------------------------------------ */

const BADGE_ICONS: Record<string, string> = {
  first_steps: 'F',
  style_master: 'S',
  bug_hunter: 'B',
  consistent: 'C',
  marathoner: 'M',
  polyglot: 'P',
  perfectionist: '!',
  reformed: 'R',
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState<AchievementStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await apiWithAuth<AchievementStatus[]>('/api/achievements');
      if (res.ok) {
        setAchievements(res.data);
      } else {
        setError(res.error.message);
      }
      setLoading(false);
    })();
  }, []);

  const unlocked = achievements.filter((a) => a.unlocked).length;

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-2.75rem)] items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[calc(100vh-2.75rem)] flex-col items-center justify-center gap-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Achievements</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {unlocked} of {achievements.length} unlocked
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Trophy className="h-4 w-4" />
          <span className="font-medium tabular-nums">{unlocked}</span>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {achievements.map((a) => (
          <AchievementCard key={a.code} achievement={a} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Achievement card                                                   */
/* ------------------------------------------------------------------ */

function AchievementCard({ achievement }: { achievement: AchievementStatus }) {
  const { code, name, description, criteria, unlocked, unlockedAt, progress } = achievement;
  const pct = progress.target > 0 ? Math.round((progress.current / progress.target) * 100) : 0;
  const letter = BADGE_ICONS[code] ?? '?';

  return (
    <div
      className={cn(
        'rounded-md border p-4 transition-colors',
        unlocked
          ? 'border-border bg-card'
          : 'border-border/60 bg-muted/40',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Badge */}
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold',
            unlocked
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted-foreground/15 text-muted-foreground/50',
          )}
        >
          {letter}
        </div>

        <div className="min-w-0 flex-1">
          <h3
            className={cn(
              'text-sm font-medium',
              !unlocked && 'text-muted-foreground',
            )}
          >
            {name}
          </h3>
          <p
            className={cn(
              'mt-0.5 text-xs leading-relaxed',
              unlocked ? 'text-muted-foreground' : 'text-muted-foreground/70',
            )}
          >
            {unlocked ? description : criteria}
          </p>

          {/* Progress or unlock date */}
          {unlocked ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Unlocked{' '}
              {unlockedAt
                ? new Date(unlockedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : ''}
            </p>
          ) : (
            <div className="mt-2">
              <div className="mb-0.5 flex items-center justify-between">
                <span className="text-[11px] tabular-nums text-muted-foreground/70">
                  {progress.current} / {progress.target}
                </span>
                <span className="text-[11px] tabular-nums text-muted-foreground/70">
                  {pct}%
                </span>
              </div>
              <ProgressBar
                value={pct}
                trackClass="bg-muted-foreground/10"
                fillClass="bg-muted-foreground/30"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
