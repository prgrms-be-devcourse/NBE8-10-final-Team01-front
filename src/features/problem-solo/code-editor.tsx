"use client";

import Editor from "@monaco-editor/react";

interface SoloCodeEditorProps {
  languages: string[];
  language: string;
  onLanguageChange: (nextLanguage: string) => void;
  value: string;
  onChange: (nextValue: string) => void;
  onRun?: () => void;
  onSubmit?: () => void;
  onResetDraft?: () => void;
  runDisabled?: boolean;
  submitDisabled?: boolean;
  runLabel?: string;
  submitLabel?: string;
  height?: string;
  className?: string;
}

const editorOptions = {
  automaticLayout: true,
  fontFamily: "var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace",
  fontLigatures: false,
  fontSize: 14,
  lineNumbersMinChars: 3,
  minimap: {
    enabled: false,
  },
  padding: {
    top: 16,
    bottom: 16,
  },
  roundedSelection: false,
  scrollBeyondLastLine: false,
  tabSize: 2,
};

function toMonacoLanguage(language: string) {
  if (language === "python3") {
    return "python";
  }

  return language;
}

export default function SoloCodeEditor({
  languages,
  language,
  onLanguageChange,
  value,
  onChange,
  onRun,
  onSubmit,
  onResetDraft,
  runDisabled = false,
  submitDisabled = false,
  runLabel = "Run",
  submitLabel = "Submit",
  height = "26rem",
  className = "",
}: SoloCodeEditorProps) {
  return (
    <div
      className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border border-app-border bg-app-base ${className}`.trim()}
    >
      <div className="flex h-12 items-center gap-3 border-b border-app-border bg-app-base px-4">
        <span className="font-mono text-lg font-semibold text-app-success">
          &lt;/&gt;
        </span>
        <span className="ml-2 text-sm font-semibold text-app-primary">
          Code
        </span>

        <div className="relative ml-1">
          <select
            value={language}
            onChange={(event) => onLanguageChange(event.target.value)}
            className="h-8 min-w-[7.5rem] appearance-none rounded-md border border-app-border bg-app-base px-2 pr-7 text-sm text-app-primary outline-none transition focus:border-app-border-strong"
          >
            {languages.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-app-muted">
            ▼
          </span>
        </div>

        {onResetDraft ? (
          <div className="group relative">
            <button
              type="button"
              onClick={onResetDraft}
              aria-label="Reset draft"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-app-border bg-app-base text-app-secondary transition hover:border-app-border-strong hover:text-app-primary"
            >
              <span className="text-sm">↻</span>
            </button>

            <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-app-border bg-app-surface px-2 py-1 text-xs text-app-primary opacity-0 shadow-lg transition group-hover:opacity-100">
              현재 언어의 임시 코드를 초기화합니다
            </div>
          </div>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onRun}
            disabled={runDisabled || !onRun}
            className="rounded-md border border-app-border-strong bg-app-base px-2.5 py-1 text-xs font-semibold text-app-primary transition hover:border-app-border-strong disabled:cursor-not-allowed disabled:border-app-border disabled:text-app-dim"
          >
            {runLabel}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitDisabled || !onSubmit}
            className="rounded-md border border-app-border bg-app-elevated px-2.5 py-1 text-xs font-semibold text-app-primary transition hover:bg-app-surface disabled:cursor-not-allowed disabled:border-app-border disabled:bg-app-base disabled:text-app-dim"
          >
            {submitLabel}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <Editor
          height={height}
          defaultLanguage={toMonacoLanguage(language)}
          language={toMonacoLanguage(language)}
          value={value}
          onChange={(nextValue) => onChange(nextValue ?? "")}
          theme="vs-dark"
          options={editorOptions}
          loading={
            <div
              className="flex items-center justify-center text-sm text-app-secondary"
              style={{ height }}
            >
              에디터를 불러오는 중입니다.
            </div>
          }
        />
      </div>
    </div>
  );
}
