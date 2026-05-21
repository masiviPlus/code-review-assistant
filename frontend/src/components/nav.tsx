'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser, useLogout } from '@/contexts/auth-context';
import { apiWithAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const AUTH_PATHS = ['/login', '/register'];

/* ------------------------------------------------------------------ */
/*  Points summary type (mirrors backend PointsSummary)                */
/* ------------------------------------------------------------------ */

interface PointsSummary {
  totalPoints: number;
  currentLevel: number;
  pointsToNextLevel: number | null;
  streak: number;
}

/* ------------------------------------------------------------------ */
/*  Level thresholds (must match backend)                              */
/* ------------------------------------------------------------------ */

const LEVEL_THRESHOLDS = [0, 50, 150, 400, 1000];

export function Nav() {
  const pathname = usePathname();
  const { user, loading } = useUser();
  const logout = useLogout();

  // Hide nav on auth pages
  if (AUTH_PATHS.some((p) => pathname.startsWith(p))) return null;

  return (
    <nav className="flex h-11 shrink-0 items-center justify-between border-b border-border px-4">
      <div className="flex items-center gap-4">
        <Link
          href={user ? '/dashboard' : '/'}
          className="text-sm font-semibold tracking-tight"
        >
          Code Review Assistant
        </Link>
        {user && (
          <div className="flex items-center gap-1">
            <NavLink href="/dashboard" current={pathname}>
              Dashboard
            </NavLink>
            <NavLink href="/submit" current={pathname}>
              Submit
            </NavLink>
            <NavLink href="/achievements" current={pathname}>
              Achievements
            </NavLink>
          </div>
        )}
      </div>

      {!loading && (
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <LevelIndicator />
              <span className="hidden text-xs text-muted-foreground sm:block">
                {user.displayName}
              </span>
              <Button variant="ghost" size="sm" onClick={logout}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">Create account</Link>
              </Button>
            </>
          )}
        </div>
      )}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  Level indicator with hover tooltip                                 */
/* ------------------------------------------------------------------ */

function LevelIndicator() {
  const [summary, setSummary] = useState<PointsSummary | null>(null);

  useEffect(() => {
    (async () => {
      const res = await apiWithAuth<PointsSummary>('/api/points/me');
      if (res.ok) setSummary(res.data);
    })();
  }, []);

  if (!summary) return null;

  const { currentLevel, totalPoints, pointsToNextLevel, streak } = summary;

  // Calculate progress percentage to next level
  const currentThreshold = LEVEL_THRESHOLDS[currentLevel - 1] ?? 0;
  const nextThreshold = LEVEL_THRESHOLDS[currentLevel] ?? null;
  let progressPct = 100;
  if (nextThreshold !== null) {
    const range = nextThreshold - currentThreshold;
    const progress = totalPoints - currentThreshold;
    progressPct = Math.round((progress / range) * 100);
  }

  return (
    <div className="group relative hidden sm:block">
      {/* Compact display */}
      <div className="flex cursor-default items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-accent">
        <span className="text-[11px] font-semibold tabular-nums text-foreground">
          Lv {currentLevel}
        </span>
        <div className="h-1 w-12 rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Hover tooltip */}
      <div className="pointer-events-none absolute right-0 top-full z-50 mt-1 w-48 rounded-md border border-border bg-card p-3 opacity-0 shadow-sm transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Level</span>
            <span className="font-medium">{currentLevel}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total points</span>
            <span className="font-medium tabular-nums">{totalPoints}</span>
          </div>
          {pointsToNextLevel !== null && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Next level in</span>
              <span className="font-medium tabular-nums">{pointsToNextLevel} pts</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Day streak</span>
            <span className="font-medium tabular-nums">{streak}</span>
          </div>
          {nextThreshold !== null && (
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{currentThreshold}</span>
                <span>{nextThreshold}</span>
              </div>
              <div className="h-1 w-full rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NavLink({
  href,
  current,
  children,
}: {
  href: string;
  current: string;
  children: React.ReactNode;
}) {
  const active = current.startsWith(href);
  return (
    <Link
      href={href}
      className={cn(
        'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
        active
          ? 'bg-accent text-foreground'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </Link>
  );
}
