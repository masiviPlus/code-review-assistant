'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Editor, { type OnMount } from '@monaco-editor/react';
import { type editor } from 'monaco-editor';

import { apiWithAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { useMonacoTheme } from '@/lib/use-monaco-theme';

/* ------------------------------------------------------------------ */
/*  Sample snippets for quick demos                                    */
/* ------------------------------------------------------------------ */

const SAMPLES = [
  {
    label: 'FizzBuzz',
    code: `function fizzBuzz(n) {
  for (var i = 1; i <= n; i++) {
    if (i % 15 === 0) console.log("FizzBuzz");
    else if (i % 3 === 0) console.log("Fizz");
    else if (i % 5 === 0) console.log("Buzz");
    else console.log(i);
  }
}

fizzBuzz(30);`,
  },
  {
    label: 'Fetch users',
    code: `async function getUsers() {
  let response = await fetch("/api/users");
  let data = response.json();
  for (let i = 0; i < data.length; i++) {
    console.log(data[i].name);
  }
  return data;
}

getUsers();`,
  },
  {
    label: 'Todo list',
    code: `class TodoList {
  constructor() {
    this.todos = [];
  }

  add(text) {
    this.todos.push({ text: text, done: false, id: Math.random() });
  }

  toggle(id) {
    for (var i = 0; i < this.todos.length; i++) {
      if (this.todos[i].id == id) {
        this.todos[i].done = !this.todos[i].done;
      }
    }
  }

  remove(id) {
    this.todos = this.todos.filter(function (t) {
      return t.id != id;
    });
  }

  list() {
    this.todos.forEach(function (t) {
      console.log((t.done ? "[x] " : "[ ] ") + t.text);
    });
  }
}

var app = new TodoList();
app.add("Write tests");
app.add("Fix bugs");
app.toggle(app.todos[0].id);
app.list();`,
  },
];

/* ------------------------------------------------------------------ */
/*  Languages                                                          */
/* ------------------------------------------------------------------ */

const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript', enabled: true },
  { value: 'typescript', label: 'TypeScript', enabled: false },
  { value: 'python', label: 'Python', enabled: false },
] as const;

/* ------------------------------------------------------------------ */
/*  Submission response types                                          */
/* ------------------------------------------------------------------ */

interface SubmissionResponse {
  submission: {
    _id: string;
  };
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function SubmitPage() {
  const router = useRouter();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const monacoTheme = useMonacoTheme();
  const [language] = useState('javascript');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sampleIndex, setSampleIndex] = useState(0);

  const nextSample = SAMPLES[sampleIndex];

  const handleEditorMount: OnMount = (ed) => {
    editorRef.current = ed;
  };

  const loadSample = useCallback(() => {
    const sample = SAMPLES[sampleIndex];
    editorRef.current?.setValue(sample.code);
    setSampleIndex((i) => (i + 1) % SAMPLES.length);
  }, [sampleIndex]);

  async function handleSubmit() {
    const code = editorRef.current?.getValue()?.trim();

    if (!code) {
      setError('Paste or type some code before submitting.');
      return;
    }

    if (code.length > 10_000) {
      setError('Code must be 10 000 characters or fewer.');
      return;
    }

    setError(null);
    setSubmitting(true);

    const res = await apiWithAuth<SubmissionResponse>('/api/submissions', {
      method: 'POST',
      body: JSON.stringify({ code, language }),
    });

    setSubmitting(false);

    if (res.ok) {
      router.push(`/submissions/${res.data.submission._id}`);
    } else {
      setError(res.error.message);
    }
  }

  return (
    <div className="flex h-[calc(100vh-2.75rem)] flex-col">
      {/* ---- Toolbar ---- */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-3">
          {/* Language selector */}
          <div className="relative">
            <select
              value={language}
              disabled
              className="h-8 appearance-none rounded-md border border-input bg-background px-3 pr-8 text-xs font-medium text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-100"
            >
              {LANGUAGES.map((lang) => (
                <option
                  key={lang.value}
                  value={lang.value}
                  disabled={!lang.enabled}
                >
                  {lang.label}
                  {!lang.enabled ? ' (coming soon)' : ''}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M3 4.5L6 7.5L9 4.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadSample}>
            Try: {nextSample.label}
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Analysing\u2026' : 'Submit for review'}
          </Button>
        </div>
      </div>

      {/* ---- Error banner ---- */}
      {error && (
        <div className="border-b border-destructive/20 bg-destructive/5 px-4 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* ---- Editor ---- */}
      <div className="flex-1">
        <Editor
          defaultLanguage="javascript"
          defaultValue="// Paste your JavaScript code here…"
          theme={monacoTheme}
          onMount={handleEditorMount}
          options={{
            fontSize: 13,
            fontFamily: 'var(--font-jetbrains), JetBrains Mono, monospace',
            minimap: { enabled: false },
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            padding: { top: 16 },
            renderLineHighlight: 'gutter',
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
            automaticLayout: true,
          }}
          loading={
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading editor…
            </div>
          }
        />
      </div>
    </div>
  );
}
