import { cn } from '@/lib/utils';
import type { TopIssue } from '@/lib/types';

const CATEGORY_LABELS: Record<string, string> = {
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
  totalSubmissions,
}: {
  issues: TopIssue[];
  totalSubmissions: number;
}) {
  if (totalSubmissions < 3) {
    return (
      <div className="px-4 py-6 text-center text-xs text-muted-foreground">
        Submit a few more reviews to see patterns here.
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-xs text-muted-foreground">
        No recurring issues found.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {issues.map((issue, i) => (
        <div key={i} className="flex items-start gap-2.5 px-4 py-2.5">
          <span
            className={cn(
              'mt-1.5 h-2 w-2 shrink-0 rounded-full',
              SEVERITY_DOT[issue.severity] ?? 'bg-muted-foreground',
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <span
                className="text-xs font-medium leading-snug line-clamp-2"
                title={issue.message}
              >
                {issue.message}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {issue.count}&times;
              </span>
            </div>
            <span className="mt-0.5 inline-block text-[10px] text-muted-foreground">
              {CATEGORY_LABELS[issue.category] ?? issue.category}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
