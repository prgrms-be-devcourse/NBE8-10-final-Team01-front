"use client";

import Editor from "@monaco-editor/react";

interface BattleCodeEditorProps {
  language: string;
  value: string;
  onChange: (nextValue: string) => void;
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
  language,
  value,
  onChange,
}: BattleCodeEditorProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-300 bg-zinc-950">
      <Editor
        height="26rem"
        defaultLanguage={language}
        language={language}
        value={value}
        onChange={(nextValue) => onChange(nextValue ?? "")}
        theme="vs-dark"
        options={editorOptions}
        loading={
          <div className="flex h-[26rem] items-center justify-center text-sm text-zinc-300">
            에디터를 불러오는 중입니다.
          </div>
        }
      />
    </div>
  );
}
