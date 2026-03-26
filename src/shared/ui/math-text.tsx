"use client";

import katex from "katex";

type Segment =
  | { type: "text"; value: string }
  | { type: "inline"; value: string }
  | { type: "block"; value: string };

/**
 * 텍스트에서 LaTeX 수식 구간을 파싱합니다.
 *
 * 지원 구분자 (우선순위 순):
 *   $$$...$$$  → inline math  (Codeforces 스타일)
 *   $$...$$    → block math   (표준 display math)
 *   $...$      → inline math  (표준 inline math)
 */
function parse(text: string): Segment[] {
  const segments: Segment[] = [];
  const regex = /\$\$\$([\s\S]+?)\$\$\$|\$\$([\s\S]+?)\$\$|\$([\s\S]+?)\$/g;
  let last = 0;

  for (const match of text.matchAll(regex)) {
    if (match.index > last) {
      segments.push({ type: "text", value: text.slice(last, match.index) });
    }

    if (match[1] !== undefined) {
      segments.push({ type: "inline", value: match[1] });
    } else if (match[2] !== undefined) {
      segments.push({ type: "block", value: match[2] });
    } else if (match[3] !== undefined) {
      segments.push({ type: "inline", value: match[3] });
    }

    last = match.index + match[0].length;
  }

  if (last < text.length) {
    segments.push({ type: "text", value: text.slice(last) });
  }

  return segments;
}

function renderMath(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      output: "html",
    });
  } catch {
    return latex;
  }
}

interface MathTextProps {
  children: string;
  className?: string;
}

/**
 * 문자열 안의 LaTeX 수식($, $$, $$$)을 KaTeX로 렌더링합니다.
 * 수식이 없는 일반 텍스트는 그대로 출력합니다.
 */
export function MathText({ children, className }: MathTextProps) {
  const segments = parse(children);

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (seg.type === "text") {
          return (
            <span key={i} style={{ whiteSpace: "pre-line" }}>
              {seg.value}
            </span>
          );
        }

        return (
          <span
            key={i}
            dangerouslySetInnerHTML={{
              __html: renderMath(seg.value, seg.type === "block"),
            }}
          />
        );
      })}
    </span>
  );
}
