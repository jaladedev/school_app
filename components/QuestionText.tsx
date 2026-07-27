"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

/**
 * Renders quiz_questions.question_text as markdown with LaTeX math
 * support ($inline$ / $$block$$), same plugins as topic notes. Kept as
 * its own small component (rather than reusing TopicContent) since a
 * question needs no resource markers, no mermaid diagrams, and sits
 * inline next to a "N." prefix and a "(points)" suffix rather than as a
 * full note body — [&_p]:mb-0 collapses the paragraph margin that
 * .topic-prose normally adds, so a single-line question doesn't leave a
 * gap before its options.
 */
export function QuestionText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`topic-prose text-sm text-ink [&_p]:mb-0 ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
