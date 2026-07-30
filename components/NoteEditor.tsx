"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import "katex/dist/katex.min.css";
import { saveTopicNote, createMermaidResource } from "@/lib/actions/teacher";
import { emitToast } from "@/lib/toast";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import { ResourceChip } from "@/lib/tiptap/resource-node";
import { MathInline, MathBlock } from "@/lib/tiptap/math-nodes";
import type { TopicResource } from "@/types/database";

const RESOURCE_TYPE_LABEL: Record<TopicResource["resource_type"], string> = {
  image: "Image",
  diagram_mermaid: "Diagram",
  video: "Video",
  pdf: "PDF",
  link: "Link",
  audio: "Audio",
};

const DEFAULT_MERMAID = "flowchart TD\n  A[Start] --> B[End]";

export function NoteEditor({
  topicId,
  noteId,
  initialContent,
  initialStatus,
  resources = [],
}: {
  topicId: string;
  noteId?: string;
  initialContent: string;
  initialStatus: "draft" | "published" | "archived" | "unwritten";
  resources?: TopicResource[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [diagramPanelOpen, setDiagramPanelOpen] = useState(false);
  const [diagramTitle, setDiagramTitle] = useState("");
  const [diagramCode, setDiagramCode] = useState(DEFAULT_MERMAID);
  const [isSavingDiagram, setIsSavingDiagram] = useState(false);
  const [mobileTab, setMobileTab] = useState<"write" | "preview">("write");
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [bubblePos, setBubblePos] = useState<{ top: number; left: number } | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  // Same reasoning as the textarea version: resources is a one-time
  // server-component snapshot, so a diagram created via
  // createMermaidResource wouldn't show up in the picker/chip resolution
  // until a full refresh unless we keep a local copy.
  const [localResources, setLocalResources] = useState(resources);
  useEffect(() => setLocalResources(resources), [resources]);

  const editor = useEditor({
    extensions: [
      // StarterKit v3 bundles Link internally, so adding a separate
      // Link extension instance here duplicates it.
      StarterKit.configure({
        link: { openOnClick: false, autolink: true },
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({
        placeholder:
          "Write the topic explanation here. Use tables for summaries, and the ∑ button for math.",
      }),
      ResourceChip,
      MathInline,
      MathBlock,
      // tiptap-markdown has no top-level `markdownIt` hook -- each
      // node registers its own markdown-it rules via
      // `storage.markdown.parse.setup`, wired on ResourceChip/MathInline/
      // MathBlock themselves (see resource-node.tsx / math-nodes.tsx).
      // Keeping [[resource:ID]] and $/$$ parsing there means it fires
      // for *every* editor instance automatically, with no risk of a
      // call site forgetting to pass the plugin in.
      Markdown.configure({
        html: false,
        transformPastedText: true,
      }),
    ],
    content: initialContent,
    // contentType lets tiptap-markdown know `initialContent` is markdown
    // text, not HTML -- it parses it through the markdown-it pipeline
    // above on mount.
    // @ts-expect-error -- provided by the Markdown extension
    contentType: "markdown",
  });

  // Pass the live resource list into the ResourceChip node's storage so
  // its NodeView can resolve id -> title/icon without re-serializing the
  // doc every time a resource is renamed elsewhere.
  useEffect(() => {
    if (editor) editor.storage.resourceChip.resources = localResources;
  }, [editor, localResources]);

  const getMarkdown = () => (editor as any)?.storage.markdown.getMarkdown() as string;

  const initialMarkdown = useMemo(() => initialContent, [initialContent]);
  const [lastSavedContent, setLastSavedContent] = useState(initialMarkdown);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!editor) return;
    function onUpdate() {
      setIsDirty(getMarkdown() !== lastSavedContent);
    }
    editor.on("update", onUpdate);
    return () => {
      editor.off("update", onUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, lastSavedContent]);

  function handleSave(status: "draft" | "published") {
    if (!editor) return;
    setError(null);
    if (status === "draft") setIsSavingDraft(true);
    const content = getMarkdown();
    startTransition(async () => {
      try {
        await saveTopicNote(topicId, content, status);
        setLastSavedContent(content);
        setIsDirty(false);
        emitToast(status === "published" ? "Topic note published." : "Draft saved.");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unable to save the topic note.";
        setError(message);
        emitToast(message, "error");
      } finally {
        setIsSavingDraft(false);
      }
    });
  }

  useEffect(() => {
    if (!pickerOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [pickerOpen]);

  // Same deliberate choice as before: warn on close, don't autosave --
  // saveTopicNote is append-only (each save is a new version row), so
  // autosaving on every navigation attempt would flood version history.
  useEffect(() => {
    if (!isDirty) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Ctrl/Cmd+S still saves a draft. Ctrl/Cmd+B and +I are now handled
  // natively by StarterKit's keymap, so only the app-specific shortcut
  // needs wiring here.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave("draft");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  function insertResourceMarker(resource: TopicResource) {
    editor
      ?.chain()
      .focus()
      .insertContent({ type: "resourceChip", attrs: { id: resource.id } })
      .run();
  }

  function handlePickResource(resource: TopicResource) {
    insertResourceMarker(resource);
    setPickerOpen(false);
  }

  function insertTable() {
    editor?.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run();
  }

  function insertMath(displayMode: boolean) {
    editor
      ?.chain()
      .focus()
      .insertContent({ type: displayMode ? "mathBlock" : "mathInline", attrs: { latex: "" } })
      .run();
  }

  async function handleSaveDiagram() {
    if (!noteId) return;
    if (!diagramCode.trim()) {
      emitToast("Write some Mermaid code before saving.", "error");
      return;
    }
    setIsSavingDiagram(true);
    try {
      const resource = await createMermaidResource(
        topicId,
        noteId,
        diagramTitle || "Diagram",
        diagramCode
      );
      setLocalResources((prev) => [...prev, resource]);
      insertResourceMarker(resource);
      emitToast("Diagram added to the note.");
      setDiagramPanelOpen(false);
      setDiagramTitle("");
      setDiagramCode(DEFAULT_MERMAID);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unable to save the diagram.";
      emitToast(message, "error");
    } finally {
      setIsSavingDiagram(false);
    }
  }

  if (!editor) return null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-ink-soft">
          Currently: {initialStatus}
          {isDirty && <span className="ml-2 normal-case text-marigold-dark">Unsaved changes</span>}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative" ref={pickerRef}>
            <button
              type="button"
              onClick={() => setPickerOpen((open) => !open)}
              disabled={isPending || localResources.length === 0}
              className="rounded-lg border border-rule px-3 py-1.5 text-sm text-ink hover:bg-paper disabled:opacity-60"
              title={
                localResources.length === 0 ? "No resources attached to this topic yet" : undefined
              }
            >
              Insert resource
            </button>
            {pickerOpen && localResources.length > 0 && (
              <div className="absolute right-0 z-10 mt-1 max-h-64 w-64 overflow-y-auto rounded-lg border border-rule bg-white py-1 shadow-lg">
                {localResources.map((resource) => (
                  <button
                    key={resource.id}
                    type="button"
                    onClick={() => handlePickResource(resource)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-paper"
                  >
                    <span className="truncate">{resource.title ?? "Untitled resource"}</span>
                    <span className="shrink-0 text-xs uppercase tracking-wide text-ink-soft">
                      {RESOURCE_TYPE_LABEL[resource.resource_type]}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setDiagramPanelOpen((open) => !open)}
            disabled={isPending || !noteId}
            className="rounded-lg border border-rule px-3 py-1.5 text-sm text-ink hover:bg-paper disabled:opacity-60"
            title={!noteId ? "Save the note once before generating a diagram" : undefined}
          >
            Generate Mermaid diagram
          </button>

          <button
            onClick={() => handleSave("draft")}
            disabled={isPending}
            className="rounded-lg border border-rule px-3 py-1.5 text-sm text-ink hover:bg-paper disabled:opacity-60"
          >
            {isSavingDraft ? "Saving…" : "Save draft"}
          </button>
          <button
            onClick={() => handleSave("published")}
            disabled={isPending}
            className="rounded-lg bg-marigold px-3 py-1.5 text-sm font-medium text-ink hover:bg-marigold-dark disabled:opacity-60"
          >
            Publish
          </button>
        </div>
      </div>

      {diagramPanelOpen && noteId && (
        <section className="mb-4 rounded-xl border border-rule bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-ink">
              Generate Mermaid diagram
            </h3>
            <button
              type="button"
              onClick={() => setDiagramPanelOpen(false)}
              className="text-xs text-ink-soft hover:underline"
            >
              Close
            </button>
          </div>
          <input
            type="text"
            value={diagramTitle}
            onChange={(e) => setDiagramTitle(e.target.value)}
            placeholder="Diagram title (optional)"
            className="mb-2 w-full rounded-lg border border-rule bg-white p-2 text-sm text-ink outline-none focus-visible:border-marigold"
          />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft">
                Mermaid code
              </p>
              <textarea
                value={diagramCode}
                onChange={(e) => setDiagramCode(e.target.value)}
                rows={10}
                className="w-full rounded-lg border border-rule bg-white p-3 font-mono text-sm text-ink outline-none focus-visible:border-marigold"
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft">
                Preview
              </p>
              <div className="h-full min-h-[10rem] rounded-lg border border-rule bg-paper p-2">
                <MermaidDiagram code={diagramCode} title={diagramTitle || undefined} />
              </div>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handleSaveDiagram}
              disabled={isSavingDiagram}
              className="rounded-lg bg-marigold px-3 py-1.5 text-sm font-medium text-ink hover:bg-marigold-dark disabled:opacity-60"
            >
              {isSavingDiagram ? "Saving…" : "Insert diagram into note"}
            </button>
          </div>
        </section>
      )}

      {/* Toolbar — same button set as before, now driving TipTap commands
          instead of string manipulation. Undo/redo, underline, strike,
          blockquote, and hr are "free" wins from StarterKit's default
          keymap/commands and just need buttons wired, per the to-do's #2. */}
      <div className="mb-2 flex flex-wrap items-center gap-1 rounded-lg border border-rule bg-paper p-1">
        <button
          type="button"
          title="Undo"
          onClick={() => editor.chain().focus().undo().run()}
          className="min-w-[2rem] rounded-md px-2 py-1 text-sm hover:bg-white"
        >
          ↺
        </button>
        <button
          type="button"
          title="Redo"
          onClick={() => editor.chain().focus().redo().run()}
          className="min-w-[2rem] rounded-md px-2 py-1 text-sm hover:bg-white"
        >
          ↻
        </button>
        <span className="mx-1 h-4 w-px bg-rule" />
        <button
          type="button"
          title="Bold"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`min-w-[2rem] rounded-md px-2 py-1 text-sm font-semibold hover:bg-white ${editor.isActive("bold") ? "bg-white" : ""}`}
        >
          B
        </button>
        <button
          type="button"
          title="Italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`min-w-[2rem] rounded-md px-2 py-1 text-sm italic hover:bg-white ${editor.isActive("italic") ? "bg-white" : ""}`}
        >
          I
        </button>
        <button
          type="button"
          title="Heading"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`min-w-[2rem] rounded-md px-2 py-1 text-sm font-semibold hover:bg-white ${editor.isActive("heading", { level: 2 }) ? "bg-white" : ""}`}
        >
          H
        </button>
        <span className="mx-1 h-4 w-px bg-rule" />
        <button
          type="button"
          title="Bulleted list"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`min-w-[2rem] rounded-md px-2 py-1 text-sm hover:bg-white ${editor.isActive("bulletList") ? "bg-white" : ""}`}
        >
          •
        </button>
        <button
          type="button"
          title="Numbered list"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`min-w-[2rem] rounded-md px-2 py-1 text-sm hover:bg-white ${editor.isActive("orderedList") ? "bg-white" : ""}`}
        >
          1.
        </button>
        <button
          type="button"
          title="Blockquote"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`min-w-[2rem] rounded-md px-2 py-1 text-sm hover:bg-white ${editor.isActive("blockquote") ? "bg-white" : ""}`}
        >
          &ldquo;
        </button>
        <span className="mx-1 h-4 w-px bg-rule" />
        <button
          type="button"
          title="Inline math (LaTeX)"
          onClick={() => insertMath(false)}
          className="min-w-[2rem] rounded-md px-2 py-1 text-sm hover:bg-white"
        >
          ∑
        </button>
        <button
          type="button"
          title="Block math (LaTeX)"
          onClick={() => insertMath(true)}
          className="min-w-[2rem] rounded-md px-2 py-1 text-sm hover:bg-white"
        >
          ∑∑
        </button>
        <button
          type="button"
          title="Insert table"
          onClick={insertTable}
          className="min-w-[2rem] rounded-md px-2 py-1 text-sm hover:bg-white"
        >
          Table
        </button>
      </div>

      {editor && (
        <BubbleMenu editor={editor}>
          <div className="flex items-center gap-1 rounded-lg border border-rule bg-white px-1 py-1 shadow-lg">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className="rounded px-2 py-1 text-sm font-semibold hover:bg-paper"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className="rounded px-2 py-1 text-sm italic hover:bg-paper"
            >
              I
            </button>
            <button
              type="button"
              onClick={() => {
                const url = window.prompt("Link URL (include https://)");
                if (url) editor.chain().focus().setLink({ href: url }).run();
              }}
              className="rounded px-2 py-1 text-sm hover:bg-paper"
            >
              🔗
            </button>
          </div>
        </BubbleMenu>
      )}

      {/* Mobile: tabbed write/preview so the two panes aren't squeezed
          side-by-side on a phone/tablet. Note: with TipTap the "editor"
          IS the rendered view now, so "Preview" here is a read-only
          render of the same doc rather than a second, separate pane. */}
      <div className="mb-2 flex gap-1 rounded-lg border border-rule bg-paper p-1 md:hidden">
        <button
          type="button"
          onClick={() => setMobileTab("write")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${mobileTab === "write" ? "bg-white text-ink shadow-sm" : "text-ink-soft"}`}
        >
          Write
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("preview")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${mobileTab === "preview" ? "bg-white text-ink shadow-sm" : "text-ink-soft"}`}
        >
          Preview
        </button>
      </div>

      <div
        className={`topic-prose min-h-[24rem] rounded-lg border border-rule bg-white p-4 ${mobileTab === "preview" ? "md:block" : ""}`}
      >
        <EditorContent editor={editor} />
      </div>

      <p className="mt-3 text-xs text-ink-soft">
        Images, videos, and other uploaded resources are attached separately after publishing — use
        &quot;Insert resource&quot; to place one at a specific point in the text, or &quot;Generate
        Mermaid diagram&quot; to create and insert a new diagram directly. Click the ∑ / ∑∑ buttons
        to add math, then click the equation to edit its LaTeX.
      </p>
      {error && <p className="mt-2 text-sm text-clay">{error}</p>}
    </div>
  );
}
