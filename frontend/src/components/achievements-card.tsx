import Link from 'next/link';
import { Trophy } from 'lucide-react';
import type { AchievementStatus } from '@/lib/types';

export function AchievementsCard({ achievements }: { achievements: AchievementStatus[] }) {
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
