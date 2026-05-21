import { cn } from '@/lib/utils';

const ISSUE_CATEGORY_LABELS: Record<string, string> = {
  style: 'Style',
  best_practice: 'Best practice',
  logic: 'Logic',
  readability: 'Readability',
};

const SEVERITY_DOT: Record<string, string> = {
  error: 'bg-red-500 dark:bg-red-400',
  warning: 'bg-amber-500 dark:bg-amber-400',
  info: 'bg-blue-500 dark:bg-blue-400',
};

export function TopIssuesPanel({
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
