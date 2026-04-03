"use client";

import Editor from "@monaco-editor/react";

interface BattleCodeEditorProps {
  languages: string[];
  language: string;
  onLanguageChange: (nextLanguage: string) => void;
  value: string;
  onChange: (nextValue: string) => void;
  onRun?: () => void;
  onSubmit?: () => void;
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

export default function BattleCodeEditor({
  languages,
  language,
  onLanguageChange,
  value,
  onChange,
  onRun,
  onSubmit,
  runDisabled = false,
  submitDisabled = false,
  runLabel = "Run",
  submitLabel = "Submit",
  height = "26rem",
  className = "",
}: BattleCodeEditorProps) {
  const monacoLanguage = language === "python3" ? "python" : language;

  return (
    <div
      className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 ${className}`.trim()}
    >
      <div className="flex h-12 items-center gap-3 border-b border-zinc-700 bg-zinc-900 px-4">
        <span className="font-mono text-lg font-semibold text-emerald-400">&lt;/&gt;</span>
        <span className="ml-2 text-sm font-semibold text-zinc-100">Code</span>
        <div className="relative ml-1">
          <select
            value={language}
            onChange={(event) => onLanguageChange(event.target.value)}
            className="h-8 min-w-[7.5rem] appearance-none rounded-md border border-zinc-700 bg-zinc-900 px-2 pr-7 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
          >
            {languages.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-zinc-400">
            ▼
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onRun}
            disabled={runDisabled || !onRun}
            className="rounded-md border border-zinc-600 bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-zinc-100 transition hover:border-zinc-400 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:text-zinc-500"
          >
            {runLabel}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitDisabled || !onSubmit}
            className="rounded-md border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            {submitLabel}
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <Editor
          height={height}
          defaultLanguage={monacoLanguage}
          language={monacoLanguage}
          value={value}
          onChange={(nextValue) => onChange(nextValue ?? "")}
          theme="vs-dark"
          options={editorOptions}
          loading={
            <div className="flex items-center justify-center text-sm text-zinc-300" style={{ height }}>
              에디터를 불러오는 중입니다.
            </div>
          }
        />
      </div>
    </div>
  );
}
