"use client";

import Editor from "@monaco-editor/react";

interface SoloCodeEditorProps {
  languages: string[];
  language: string;
  onLanguageChange: (nextLanguage: string) => void;
  value: string;
  onChange: (nextValue: string) => void;
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
  height = "26rem",
  className = "",
}: SoloCodeEditorProps) {
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
              className="flex items-center justify-center text-sm text-zinc-300"
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
