'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Editor, { type OnMount } from '@monaco-editor/react';
import { type editor } from 'monaco-editor';
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Info,
  ArrowLeft,
} from 'lucide-react';

import { apiWithAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ScoreBreakdown {
  style: number;
  bestPractices: number;
  logic: number;
  readability: number;
}

interface Issue {
  _id: string;
  severity: 'error' | 'warning' | 'info';
  category: string;
  lineNumber: number | null;
  message: string;
  suggestion: string;
}

interface Submission {
  _id: string;
  code: string;
  language: string;
  status: string;
  scoreOverall: number;
  scoreBreakdown: ScoreBreakdown;
  summary: string;
  createdAt: string;
}

interface SubmissionData {
  submission: Submission;
  issues: Issue[];
}

/* ------------------------------------------------------------------ */
/*  Severity helpers                                                   */
/* ------------------------------------------------------------------ */

const SEVERITY_ORDER: Record<string, number> = { error: 0, warning: 1, info: 2 };

const SEVERITY_CONFIG = {
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
/*  Score breakdown display labels                                     */
/* ------------------------------------------------------------------ */

const BREAKDOWN_LABELS: { key: keyof ScoreBreakdown; label: string }[] = [
  { key: 'style', label: 'Style' },
  { key: 'bestPractices', label: 'Best Practices' },
  { key: 'logic', label: 'Logic' },
  { key: 'readability', label: 'Readability' },
];

/* ------------------------------------------------------------------ */
/*  Score colour                                                       */
/* ------------------------------------------------------------------ */

function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-red-600';
}

function barColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function SubmissionPage() {
  const { id } = useParams<{ id: string }>();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);

  const [data, setData] = useState<SubmissionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);

  /* ---- Fetch submission ---- */
  useEffect(() => {
    (async () => {
      const res = await apiWithAuth<SubmissionData>(
        `/api/submissions/${id}`,
      );
      if (res.ok) {
        setData(res.data);
      } else {
        setError(res.error.message);
      }
      setLoading(false);
    })();
  }, [id]);

  /* ---- Apply decorations when editor mounts or data loads ---- */
  const applyDecorations = useCallback(
    (ed: editor.IStandaloneCodeEditor, issues: Issue[]) => {
      const decorations = issues
        .filter((i) => i.lineNumber !== null)
        .map((issue) => ({
          range: {
            startLineNumber: issue.lineNumber!,
            startColumn: 1,
            endLineNumber: issue.lineNumber!,
            endColumn: 1,
          },
          options: {
            isWholeLine: true,
            className: SEVERITY_CONFIG[issue.severity].decorationClass,
            glyphMarginClassName: `glyph-${issue.severity}`,
          },
        }));

      if (decorationsRef.current) {
        decorationsRef.current.clear();
      }
      decorationsRef.current = ed.createDecorationsCollection(decorations);
    },
    [],
  );

  const handleEditorMount: OnMount = (ed) => {
    editorRef.current = ed;
    if (data) {
      applyDecorations(ed, data.issues);
    }
  };

  /* ---- Click issue → scroll to line ---- */
  const scrollToLine = useCallback((lineNumber: number) => {
    const ed = editorRef.current;
    if (!ed) return;

    ed.revealLineInCenter(lineNumber);
    ed.setPosition({ lineNumber, column: 1 });

    // Brief flash highlight
    const flash = ed.createDecorationsCollection([
      {
        range: {
          startLineNumber: lineNumber,
          startColumn: 1,
          endLineNumber: lineNumber,
          endColumn: 1,
        },
        options: {
          isWholeLine: true,
          className: 'line-highlight-flash',
        },
      },
    ]);
    setTimeout(() => flash.clear(), 1500);
  }, []);

  /* ---- Group issues by severity ---- */
  const groupedIssues = data
    ? Object.entries(
        data.issues.reduce(
          (acc, issue) => {
            (acc[issue.severity] ??= []).push(issue);
            return acc;
          },
          {} as Record<string, Issue[]>,
        ),
      ).sort(
        ([a], [b]) =>
          (SEVERITY_ORDER[a] ?? 9) - (SEVERITY_ORDER[b] ?? 9),
      )
    : [];

  /* ---- Loading / error states ---- */
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        Loading review…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-sm text-destructive">{error ?? 'Submission not found'}</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/submit">Back to editor</Link>
        </Button>
      </div>
    );
  }

  const { submission, issues } = data;

  return (
    <div className="flex h-screen flex-col">
      {/* ---- Header ---- */}
      <header className="flex items-center gap-3 border-b border-border px-4 py-2">
        <Button variant="ghost" size="sm" asChild className="gap-1.5">
          <Link href="/submit">
            <ArrowLeft className="h-3.5 w-3.5" />
            Editor
          </Link>
        </Button>
        <div className="h-4 w-px bg-border" />
        <span className="text-xs text-muted-foreground">
          {new Date(submission.createdAt).toLocaleString()}
        </span>
      </header>

      {/* ---- Main layout ---- */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* ---- Left: code editor ---- */}
        <div className="flex-1 border-b border-border lg:border-b-0 lg:border-r min-h-[300px]">
          <Editor
            defaultLanguage={submission.language}
            value={submission.code}
            theme="vs-light"
            onMount={handleEditorMount}
            options={{
              readOnly: true,
              fontSize: 13,
              fontFamily: 'var(--font-jetbrains), JetBrains Mono, monospace',
              minimap: { enabled: false },
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              padding: { top: 16 },
              renderLineHighlight: 'none',
              overviewRulerLanes: 0,
              hideCursorInOverviewRuler: true,
              overviewRulerBorder: false,
              automaticLayout: true,
              glyphMargin: true,
              domReadOnly: true,
            }}
            loading={
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading editor…
              </div>
            }
          />
        </div>

        {/* ---- Right: review panel ---- */}
        <div className="w-full overflow-y-auto lg:w-[420px] lg:min-w-[360px]">
          {/* Score */}
          <div className="border-b border-border p-4">
            <div className="flex items-baseline gap-3">
              <span
                className={cn(
                  'text-4xl font-bold tabular-nums tracking-tight',
                  scoreColor(submission.scoreOverall),
                )}
              >
                {submission.scoreOverall}
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
          <div className="border-b border-border p-4">
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Breakdown
            </h3>
            <div className="space-y-2.5">
              {BREAKDOWN_LABELS.map(({ key, label }) => {
                const value = submission.scoreBreakdown[key];
                return (
                  <div key={key}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium">{label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {value}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-secondary">
                      <div
                        className={cn('h-full rounded-full transition-all', barColor(value))}
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

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
                                    scrollToLine(issue.lineNumber);
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
                                <div className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground"
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
      </div>
    </div>
  );
}
