/**
 * Code blocks (#25 of markdown-editor-todo.md): syntax highlighting +
 * copy button + language selector, built on the official
 * `@tiptap/extension-code-block-lowlight`.
 *
 * Markdown round-trip is NOT custom here, unlike ResourceChip/MathInline/
 * MathBlock: CodeBlockLowlight keeps the same node name ("codeBlock") and
 * attribute shape (`language`) that StarterKit's plain CodeBlock already
 * used, and tiptap-markdown's default markdown-it schema already knows
 * how to serialize/parse a fenced code block with a language info string
 * (``` ```js ... ``` ```) without any extra wiring. So this file only
 * needs to handle the editor-side rendering (highlighting + UI chrome),
 * not storage format.
 */
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import { useState } from "react";
import { createLowlight, common } from "lowlight";
import { emitToast } from "@/lib/toast";

const lowlight = createLowlight(common);

// `common` (from the `lowlight` package) bundles the languages people
// actually reach for in class notes -- covers every language a teacher
// is realistically pasting in a school-app context. Kept as a fixed list
// (rather than deriving from `lowlight.listLanguages()`, which also
// includes ~180 obscure/duplicate aliases) so the selector stays short
// enough to actually scan.
const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "plaintext", label: "Plain text" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "sql", label: "SQL" },
  { value: "bash", label: "Bash / Shell" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "markdown", label: "Markdown" },
  { value: "php", label: "PHP" },
  { value: "ruby", label: "Ruby" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
];

function CodeBlockView({
  node,
  updateAttributes,
  extension,
}: {
  node: any;
  updateAttributes: (attrs: Record<string, unknown>) => void;
  extension: any;
}) {
  const [copied, setCopied] = useState(false);
  const language: string = node.attrs.language ?? "plaintext";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(node.textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      emitToast("Couldn't copy — your browser may be blocking clipboard access.", "error");
    }
  }

  return (
    <NodeViewWrapper className="relative my-3 overflow-hidden rounded-lg border border-rule bg-[#0d1117]">
      <div
        contentEditable={false}
        className="flex items-center justify-between border-b border-white/10 bg-white/5 px-3 py-1.5"
      >
        <select
          value={language}
          onChange={(e) => updateAttributes({ language: e.target.value })}
          className="rounded border border-white/10 bg-transparent px-1.5 py-0.5 text-xs text-white/70 outline-none"
        >
          {LANGUAGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#0d1117] text-white">
              {opt.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded px-2 py-0.5 text-xs text-white/70 hover:bg-white/10"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-sm leading-relaxed">
        <NodeViewContent className={`hljs language-${language} block font-mono`} />
      </pre>
    </NodeViewWrapper>
  );
}

export const CodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
}).configure({
  lowlight,
  defaultLanguage: "plaintext",
});
