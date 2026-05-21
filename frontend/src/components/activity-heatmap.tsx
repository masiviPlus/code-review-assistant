'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scoreColor } from '@/lib/score-utils';
import type { Submission } from '@/lib/types';

const DAYS = 90;
const CELL = 11;
const GAP = 2;

interface TooltipState {
  x: number;
  y: number;
  date: string;
  count: number;
}

export function ActivityHeatmap({ submissions }: { submissions: Submission[] }) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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

  // Submissions for the selected date
  const selectedSubmissions = useMemo(() => {
    if (!selectedDate) return [];
    return submissions.filter((s) => {
      const d = new Date(s.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return key === selectedDate;
    });
  }, [submissions, selectedDate]);

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

  const handleMouseEnter = useCallback(
    (cell: { date: string; count: number; col: number; row: number }) => {
      setTooltip({
        x: cell.col * (CELL + GAP) + CELL / 2,
        y: cell.row * (CELL + GAP),
        date: cell.date,
        count: cell.count,
      });
    },
    [],
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  const handleClick = useCallback(
    (cell: { date: string; count: number }) => {
      if (cell.count === 0) return;
      setSelectedDate((prev) => (prev === cell.date ? null : cell.date));
    },
    [],
  );

  // Close sidebar on Escape
  useEffect(() => {
    if (!selectedDate) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedDate(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedDate]);

  return (
    <div className="overflow-x-auto">
      <div className="relative inline-block">
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
                cell.count > 0 && 'cursor-pointer',
                selectedDate === cell.date && 'stroke-foreground stroke-[1.5]',
                cell.count === 0
                  ? 'fill-secondary'
                  : cell.count === 1
                    ? 'fill-primary/30'
                    : cell.count === 2
                      ? 'fill-primary/55'
                      : 'fill-primary/85',
              )}
              onMouseEnter={() => handleMouseEnter(cell)}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleClick(cell)}
            />
          ))}
        </svg>
        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 whitespace-nowrap rounded border border-border bg-card px-2 py-1 text-[11px] shadow-sm"
            style={{ left: tooltip.x + CELL, top: tooltip.y }}
          >
            <span className="font-medium tabular-nums">{tooltip.count}</span>
            <span className="text-muted-foreground">
              {' '}submission{tooltip.count !== 1 ? 's' : ''} on {tooltip.date}
            </span>
          </div>
        )}
      </div>
      {/* Legend */}
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
        <span>Less</span>
        <span className="inline-block h-[9px] w-[9px] rounded-[2px] bg-secondary" />
        <span className="inline-block h-[9px] w-[9px] rounded-[2px] bg-primary/30" />
        <span className="inline-block h-[9px] w-[9px] rounded-[2px] bg-primary/55" />
        <span className="inline-block h-[9px] w-[9px] rounded-[2px] bg-primary/85" />
        <span>More</span>
      </div>

      {/* Sidebar panel */}
      {selectedDate && (
        <div className="mt-3 rounded-md border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-medium">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
              <span className="ml-1.5 text-muted-foreground">
                — {selectedSubmissions.length} submission{selectedSubmissions.length !== 1 ? 's' : ''}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              aria-label="Close"
              className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto scrollbar-thin">
            {selectedSubmissions.map((sub) => (
              <Link
                key={sub._id}
                href={`/submissions/${sub._id}`}
                className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 text-xs transition-colors last:border-b-0 hover:bg-accent/50"
              >
                <span className="text-muted-foreground">
                  {new Date(sub.createdAt).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="truncate text-muted-foreground">
                  {sub.language}
                </span>
                <span
                  className={cn(
                    'font-mono font-medium tabular-nums',
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
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
