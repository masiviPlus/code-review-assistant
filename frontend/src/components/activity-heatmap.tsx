'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { Submission } from '@/lib/types';

const DAYS = 90;
const CELL = 11;
const GAP = 2;

export function ActivityHeatmap({ submissions }: { submissions: Submission[] }) {
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
