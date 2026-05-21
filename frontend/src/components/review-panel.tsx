'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Submission, Issue, ScoreBreakdown } from '@/lib/types';
import { scoreColor, barColor } from '@/lib/score-utils';
import {
  SEVERITY_CONFIG,
  BREAKDOWN_LABELS,
  groupIssuesBySeverity,
} from '@/lib/review-utils';
import { ProgressBar } from '@/components/progress-bar';

/* ------------------------------------------------------------------ */
/*  ReviewPanel                                                        */
/* ------------------------------------------------------------------ */

export function ReviewPanel({
  submission,
  issues,
  onIssueFocus,
}: {
  submission: Submission;
  issues: Issue[];
  onIssueFocus: (lineNumber: number) => void;
}) {
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const groupedIssues = groupIssuesBySeverity(issues);

  return (
    <div className="w-full overflow-y-auto lg:w-[420px] lg:min-w-[360px]">
      {/* Score */}
      <div className="border-b border-border p-4">
        <div className="flex items-baseline gap-3">
          <span
            className={cn(
              'text-4xl font-bold tabular-nums tracking-tight',
              scoreColor(submission.scoreOverall ?? 0),
            )}
          >
            {submission.scoreOverall ?? '—'}
          </span>
          <span className="text-sm text-muted-foreground">/ 100</span>
        </div>
        {submission.summary && (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {submission.summary}
          </p>
        )}
      </div>

      {/* Breakdown bars */}
      {submission.scoreBreakdown && (
        <ScoreBreakdownBars breakdown={submission.scoreBreakdown} />
      )}

      {/* Issues */}
      <div className="p-4">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Issues
          <span className="ml-1.5 text-muted-foreground">
            ({issues.length})
          </span>
        </h3>

        {issues.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No issues found. Clean code!
          </p>
        ) : (
          <div className="space-y-4">
            {groupedIssues.map(([severity, items]) => {
              const config =
                SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG];
              const { Icon } = config;

              return (
                <div key={severity}>
                  {/* Group header */}
                  <div className="mb-2 flex items-center gap-1.5">
                    <Icon className={cn('h-3.5 w-3.5', config.text)} />
                    <span className={cn('text-xs font-medium', config.text)}>
                      {config.label}
                    </span>
                    <span
                      className={cn(
                        'ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                        config.badge,
                      )}
                    >
                      {items.length}
                    </span>
                  </div>

                  {/* Issue list */}
                  <div className="space-y-1">
                    {items.map((issue) => {
                      const isExpanded = expandedIssue === issue._id;
                      return (
                        <div
                          key={issue._id}
                          className={cn(
                            'rounded-md border text-sm transition-colors',
                            config.border,
                            isExpanded ? config.bg : 'bg-background',
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedIssue(
                                isExpanded ? null : issue._id,
                              );
                              if (issue.lineNumber !== null) {
                                onIssueFocus(issue.lineNumber);
                              }
                            }}
                            className="flex w-full items-start gap-2 px-3 py-2 text-left"
                          >
                            {isExpanded ? (
                              <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            )}
                            <span className="flex-1">{issue.message}</span>
                            {issue.lineNumber !== null && (
                              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                                L{issue.lineNumber}
                              </span>
                            )}
                          </button>

                          {isExpanded && issue.suggestion && (
                            <div
                              className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground"
                              style={{ borderColor: 'inherit' }}
                            >
                              {issue.suggestion}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Score breakdown bars (internal)                                     */
/* ------------------------------------------------------------------ */

function ScoreBreakdownBars({ breakdown }: { breakdown: ScoreBreakdown }) {
  return (
    <div className="border-b border-border p-4">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Breakdown
      </h3>
      <div className="space-y-2.5">
        {BREAKDOWN_LABELS.map(({ key, label }) => {
          const value = breakdown[key];
          return (
            <div key={key}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium">{label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {value}
                </span>
              </div>
              <ProgressBar
                value={value}
                fillClass={barColor(value)}
                className="h-1.5"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
