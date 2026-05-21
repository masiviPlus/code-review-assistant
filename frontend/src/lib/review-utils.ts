import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { Issue, ScoreBreakdown } from './types';

/* ------------------------------------------------------------------ */
/*  Severity configuration                                             */
/* ------------------------------------------------------------------ */

export const SEVERITY_ORDER: Record<string, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

export const SEVERITY_CONFIG = {
  error: {
    Icon: AlertCircle,
    label: 'Errors',
    text: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-700',
    decorationClass: 'line-highlight-error',
  },
  warning: {
    Icon: AlertTriangle,
    label: 'Warnings',
    text: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
    decorationClass: 'line-highlight-warning',
  },
  info: {
    Icon: Info,
    label: 'Info',
    text: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-700',
    decorationClass: 'line-highlight-info',
  },
} as const;

/* ------------------------------------------------------------------ */
/*  Score breakdown labels                                             */
/* ------------------------------------------------------------------ */

export const BREAKDOWN_LABELS: { key: keyof ScoreBreakdown; label: string }[] = [
  { key: 'style', label: 'Style' },
  { key: 'bestPractices', label: 'Best Practices' },
  { key: 'logic', label: 'Logic' },
  { key: 'readability', label: 'Readability' },
];

/* ------------------------------------------------------------------ */
/*  Group issues by severity, sorted error → warning → info            */
/* ------------------------------------------------------------------ */

export function groupIssuesBySeverity(
  issues: Issue[],
): [string, Issue[]][] {
  return Object.entries(
    issues.reduce(
      (acc, issue) => {
        (acc[issue.severity] ??= []).push(issue);
        return acc;
      },
      {} as Record<string, Issue[]>,
    ),
  ).sort(
    ([a], [b]) =>
      (SEVERITY_ORDER[a] ?? 9) - (SEVERITY_ORDER[b] ?? 9),
  );
}
