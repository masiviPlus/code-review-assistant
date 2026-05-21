'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Editor, { type OnMount } from '@monaco-editor/react';
import { type editor } from 'monaco-editor';
import { AlertCircle, Trophy } from 'lucide-react';

import { apiWithAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import type { Issue, SubmissionData, AchievementStatus } from '@/lib/types';
import { SEVERITY_CONFIG } from '@/lib/review-utils';
import { ReviewPanel } from '@/components/review-panel';
import { useMonacoTheme } from '@/lib/use-monaco-theme';

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function SubmissionPage() {
  const { id } = useParams<{ id: string }>();
  const monacoTheme = useMonacoTheme();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);

  const [data, setData] = useState<SubmissionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newAchievements, setNewAchievements] = useState<AchievementStatus[]>([]);

  /* ---- Fetch submission + achievements ---- */
  useEffect(() => {
    (async () => {
      const res = await apiWithAuth<SubmissionData>(
        `/api/submissions/${id}`,
      );
      if (res.ok) {
        setData(res.data);

        // Check for achievements unlocked around this submission's time
        const achRes = await apiWithAuth<AchievementStatus[]>('/api/achievements');
        if (achRes.ok) {
          const subTime = new Date(res.data.submission.createdAt).getTime();
          const recent = achRes.data.filter((a) => {
            if (!a.unlocked || !a.unlockedAt) return false;
            const diff = Math.abs(new Date(a.unlockedAt).getTime() - subTime);
            return diff < 60_000; // unlocked within 60s of submission
          });
          setNewAchievements(recent);
        }
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

  /* ---- Loading / error states ---- */
  if (loading) {
    return (
      <div className="flex h-[calc(100vh-2.75rem)] items-center justify-center text-sm text-muted-foreground">
        Loading review…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-[calc(100vh-2.75rem)] flex-col items-center justify-center gap-4">
        <p className="text-sm text-destructive">{error ?? 'Submission not found'}</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/submit">Back to editor</Link>
        </Button>
      </div>
    );
  }

  const { submission, issues } = data;

  /* ---- Failed or still analysing ---- */
  if (submission.status === 'failed') {
    return (
      <div className="flex h-[calc(100vh-2.75rem)] flex-col items-center justify-center gap-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm font-medium">Analysis failed</p>
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          {submission.summary ?? 'The code analysis could not be completed. Please try submitting again.'}
        </p>
        <Button size="sm" asChild>
          <Link href="/submit">Try again</Link>
        </Button>
      </div>
    );
  }

  if (submission.status === 'analysing') {
    return (
      <div className="flex h-[calc(100vh-2.75rem)] items-center justify-center text-sm text-muted-foreground">
        Analysis in progress… Refresh to check.
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-2.75rem)] flex-col">
      {/* ---- Achievement unlock banner ---- */}
      {newAchievements.length > 0 && (
        <div className="flex items-center gap-2 border-b border-primary/20 bg-primary/5 px-4 py-2">
          <Trophy className="h-3.5 w-3.5 shrink-0 text-primary" />
          <p className="text-xs text-foreground">
            <span className="font-medium">You unlocked: </span>
            {newAchievements.map((a, i) => (
              <span key={a.code}>
                {i > 0 && ', '}
                <span className="font-medium">{a.name}</span>
                <span className="text-muted-foreground"> &mdash; {a.description}</span>
              </span>
            ))}
          </p>
        </div>
      )}

      {/* ---- Subheader ---- */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-1.5">
        <span className="text-xs text-muted-foreground">
          {new Date(submission.createdAt).toLocaleString()}
        </span>
      </div>

      {/* ---- Main layout ---- */}
      <div className="flex min-h-0 flex-1 flex-col-reverse lg:flex-row">
        {/* ---- Left: code editor ---- */}
        <div className="flex-1 border-t border-border lg:border-r lg:border-t-0 min-h-[200px]">
          <Editor
            defaultLanguage={submission.language}
            value={submission.code}
            theme={monacoTheme}
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
        <ReviewPanel
          submission={submission}
          issues={issues}
          onIssueFocus={scrollToLine}
        />
      </div>
    </div>
  );
}
