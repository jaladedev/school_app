"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type DragEvent } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Color } from "@tiptap/extension-color";
import { TextAlign } from "@tiptap/extension-text-align";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import {
  HighlightMarkdown,
  SubscriptMarkdown,
  SuperscriptMarkdown,
  TextStyleMarkdown,
} from "@/lib/tiptap/format-marks";
import { Markdown } from "tiptap-markdown";
import "katex/dist/katex.min.css";
import { saveTopicNote, createMermaidResource, uploadTopicResource } from "@/lib/actions/teacher";
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

// Kept in sync with TopicResourceUpload.tsx's <input accept> and
// uploadTopicResource's RESOURCE_TYPES map -- checked client-side purely
// so a drag of an unsupported file gets an immediate toast instead of a
// round-trip to the server action just to find out.
const ACCEPTED_RESOURCE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "video/mp4",
  "video/webm",
]);

// TipTap gives every extension its own separate keymap plugin rather than
// merging them into one, and ProseMirror runs those plugins in order,
// stopping at the first one that returns true. List items (StarterKit's
// ListItem) and table cells (extension-table's Table) both bind Tab and
// correctly return false when there's nothing to sink/lift or no table
// cell to move to. But when EVERY plugin returns false, ProseMirror never
// calls preventDefault, and the keydown falls through to the browser's
// native focus-tabbing -- which then jumps to whatever <button> happens
// to be next in the DOM (a toolbar button, a resource chip). Registering
// this extension FIRST in the extensions array below puts it LAST in
// TipTap's (reversed) plugin-priority order, so it only fires as a
// last-resort catch-all: it absorbs Tab/Shift-Tab (no-op) instead of
// letting focus escape the editor, without pre-empting list/table
// handling that already works correctly.
const TabTrap = Extension.create({
  name: "tabTrap",
  addKeyboardShortcuts() {
    return {
      Tab: () => true,
      "Shift-Tab": () => true,
    };
  },
});

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
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const dragDepthRef = useRef(0);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  // Same reasoning as the textarea version: resources is a one-time
  // server-component snapshot, so a diagram created via
  // createMermaidResource wouldn't show up in the picker/chip resolution
  // until a full refresh unless we keep a local copy.
  const [localResources, setLocalResources] = useState(resources);
  useEffect(() => setLocalResources(resources), [resources]);

  const editor = useEditor({
    extensions: [
      TabTrap,
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
      // TextStyle is a prerequisite mark for Color -- Color just adds a
      // `color` attr onto it rather than being its own mark. The
      // *Markdown variants here (from lib/tiptap/format-marks.ts) are the
      // same extensions with markdown serialize/parse wiring added, so
      // these marks actually survive a save + reload instead of being
      // silently dropped by tiptap-markdown (which has no built-in rule
      // for them) -- see that file for the full explanation.
      TextStyleMarkdown,
      Color,
      HighlightMarkdown.configure({ multicolor: true }),
      SubscriptMarkdown,
      SuperscriptMarkdown,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
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
  // doc every time a resource is renamed elsewhere. onResourceUpdated
  // lets MermaidNodeView's in-place "Edit" flow (updateMermaidResource)
  // push the freshly-saved row back into localResources without a full
  // page refresh, the same way createMermaidResource's result already
  // does via handleSaveDiagram below.
  useEffect(() => {
    if (!editor) return;
    editor.storage.resourceChip.resources = localResources;
    editor.storage.resourceChip.onResourceUpdated = (updated: TopicResource) => {
      setLocalResources((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    };
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

  function promptForLink() {
    if (!editor) return;
    const url = window.prompt("Link URL (include https://)");
    if (url) editor.chain().focus().setLink({ href: url }).run();
  }

  // Ctrl/Cmd+S still saves a draft. Ctrl/Cmd+K opens the link prompt
  // (same logic the BubbleMenu's link button uses). Ctrl/Cmd+B and +I are
  // handled natively by StarterKit's keymap, so only these two
  // app-specific shortcuts need wiring here.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "s") {
        e.preventDefault();
        handleSave("draft");
      } else if (e.key === "k") {
        e.preventDefault();
        promptForLink();
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

  // Drag-and-drop straight onto the editor surface (#7 of the to-do).
  // Reuses the same uploadTopicResource server action as the file-picker
  // panel (TopicResourceUpload.tsx) -- this isn't a second upload path,
  // just a second entry point into the existing one -- and inserts a
  // ResourceChip at the caret for each file that succeeds, the same way
  // handleSaveDiagram does for a newly created diagram.
  async function uploadDroppedFiles(files: File[]) {
    if (!noteId) {
      emitToast("Save the note once before dragging files in.", "error");
      return;
    }
    const accepted = files.filter((f) => ACCEPTED_RESOURCE_MIME_TYPES.has(f.type));
    const rejected = files.length - accepted.length;
    if (rejected > 0) {
      emitToast(
        `${rejected} file${rejected === 1 ? "" : "s"} skipped -- use an image, PDF, audio, or video file.`,
        "error"
      );
    }
    if (accepted.length === 0) return;

    setUploadingCount(accepted.length);
    let failures = 0;
    for (const file of accepted) {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("title", "");
      try {
        const resource = await uploadTopicResource(topicId, noteId, formData);
        if (resource) {
          setLocalResources((prev) => [...prev, resource]);
          insertResourceMarker(resource);
        }
      } catch (err: unknown) {
        failures += 1;
        const message = err instanceof Error ? err.message : `Could not upload "${file.name}".`;
        emitToast(message, "error");
      } finally {
        setUploadingCount((count) => Math.max(0, count - 1));
      }
    }
    if (accepted.length - failures > 0) {
      emitToast(
        accepted.length - failures === 1
          ? "File uploaded and inserted."
          : `${accepted.length - failures} files uploaded and inserted.`
      );
    }
  }

  function handleDragEnter(e: DragEvent) {
    if (!e.dataTransfer?.types.includes("Files")) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingFile(true);
  }

  function handleDragOver(e: DragEvent) {
    if (!e.dataTransfer?.types.includes("Files")) return;
    e.preventDefault();
  }

  function handleDragLeave(e: DragEvent) {
    if (!e.dataTransfer?.types.includes("Files")) return;
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDraggingFile(false);
  }

  function handleDrop(e: DragEvent) {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingFile(false);
    void uploadDroppedFiles(Array.from(e.dataTransfer.files));
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
          title="Bold (Ctrl/Cmd+B)"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`min-w-[2rem] rounded-md px-2 py-1 text-sm font-semibold hover:bg-white ${editor.isActive("bold") ? "bg-white" : ""}`}
        >
          B
        </button>
        <button
          type="button"
          title="Italic (Ctrl/Cmd+I)"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`min-w-[2rem] rounded-md px-2 py-1 text-sm italic hover:bg-white ${editor.isActive("italic") ? "bg-white" : ""}`}
        >
          I
        </button>
        <select
          title="Paragraph style"
          value={
            editor.isActive("heading", { level: 1 })
              ? "h1"
              : editor.isActive("heading", { level: 2 })
                ? "h2"
                : editor.isActive("heading", { level: 3 })
                  ? "h3"
                  : "p"
          }
          onChange={(e) => {
            const value = e.target.value;
            const chain = editor.chain().focus();
            if (value === "p") chain.setParagraph().run();
            else chain.toggleHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 }).run();
          }}
          className="rounded-md border-none bg-transparent px-2 py-1 text-sm hover:bg-white"
        >
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>
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
        <button
          type="button"
          title="Underline (Ctrl/Cmd+U)"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`min-w-[2rem] rounded-md px-2 py-1 text-sm underline hover:bg-white ${editor.isActive("underline") ? "bg-white" : ""}`}
        >
          U
        </button>
        <button
          type="button"
          title="Strikethrough"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`min-w-[2rem] rounded-md px-2 py-1 text-sm line-through hover:bg-white ${editor.isActive("strike") ? "bg-white" : ""}`}
        >
          S
        </button>
        <label
          title="Text color"
          className="flex min-w-[2rem] cursor-pointer items-center justify-center rounded-md px-1 py-1 text-sm hover:bg-white"
        >
          A
          <input
            type="color"
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
            value={editor.getAttributes("textStyle").color || "#1f2937"}
            className="ml-0.5 h-4 w-4 cursor-pointer border-none bg-transparent p-0"
          />
        </label>
        <button
          type="button"
          title="Highlight"
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          className={`min-w-[2rem] rounded-md px-2 py-1 text-sm hover:bg-white ${editor.isActive("highlight") ? "bg-white" : ""}`}
        >
          ▧
        </button>
        <button
          type="button"
          title="Superscript"
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
          className={`min-w-[2rem] rounded-md px-2 py-1 text-sm hover:bg-white ${editor.isActive("superscript") ? "bg-white" : ""}`}
        >
          x²
        </button>
        <button
          type="button"
          title="Subscript"
          onClick={() => editor.chain().focus().toggleSubscript().run()}
          className={`min-w-[2rem] rounded-md px-2 py-1 text-sm hover:bg-white ${editor.isActive("subscript") ? "bg-white" : ""}`}
        >
          x₂
        </button>
        <span className="mx-1 h-4 w-px bg-rule" />
        <button
          type="button"
          title="Align left"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className={`min-w-[2rem] rounded-md px-2 py-1 text-sm hover:bg-white ${editor.isActive({ textAlign: "left" }) ? "bg-white" : ""}`}
        >
          ⟸
        </button>
        <button
          type="button"
          title="Align center"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className={`min-w-[2rem] rounded-md px-2 py-1 text-sm hover:bg-white ${editor.isActive({ textAlign: "center" }) ? "bg-white" : ""}`}
        >
          ⟺
        </button>
        <button
          type="button"
          title="Align right"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className={`min-w-[2rem] rounded-md px-2 py-1 text-sm hover:bg-white ${editor.isActive({ textAlign: "right" }) ? "bg-white" : ""}`}
        >
          ⟹
        </button>
        <button
          type="button"
          title="Justify"
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          className={`min-w-[2rem] rounded-md px-2 py-1 text-sm hover:bg-white ${editor.isActive({ textAlign: "justify" }) ? "bg-white" : ""}`}
        >
          ☰
        </button>
        <span className="mx-1 h-4 w-px bg-rule" />
        <button
          type="button"
          title="Checklist"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={`min-w-[2rem] rounded-md px-2 py-1 text-sm hover:bg-white ${editor.isActive("taskList") ? "bg-white" : ""}`}
        >
          ☑
        </button>
        <button
          type="button"
          title="Outdent (Shift+Tab)"
          onClick={() => {
            const itemType = editor.isActive("taskItem") ? "taskItem" : "listItem";
            editor.chain().focus().liftListItem(itemType).run();
          }}
          disabled={
            !editor.can().liftListItem("listItem") && !editor.can().liftListItem("taskItem")
          }
          className="min-w-[2rem] rounded-md px-2 py-1 text-sm hover:bg-white disabled:opacity-40"
        >
          ⇤
        </button>
        <button
          type="button"
          title="Indent (Tab)"
          onClick={() => {
            const itemType = editor.isActive("taskItem") ? "taskItem" : "listItem";
            editor.chain().focus().sinkListItem(itemType).run();
          }}
          disabled={
            !editor.can().sinkListItem("listItem") && !editor.can().sinkListItem("taskItem")
          }
          className="min-w-[2rem] rounded-md px-2 py-1 text-sm hover:bg-white disabled:opacity-40"
        >
          ⇥
        </button>
        <span className="mx-1 h-4 w-px bg-rule" />
        <button
          type="button"
          title="Horizontal rule"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="min-w-[2rem] rounded-md px-2 py-1 text-sm hover:bg-white"
        >
          ―
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
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className="rounded px-2 py-1 text-sm underline hover:bg-paper"
            >
              U
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHighlight().run()}
              className={`rounded px-2 py-1 text-sm hover:bg-paper ${editor.isActive("highlight") ? "bg-paper" : ""}`}
              title="Highlight"
            >
              ▧
            </button>
            <button
              type="button"
              onClick={promptForLink}
              className="rounded px-2 py-1 text-sm hover:bg-paper"
              title="Link (Ctrl/Cmd+K)"
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
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`topic-prose relative min-h-[24rem] rounded-lg border bg-white p-4 ${mobileTab === "preview" ? "md:block" : ""} ${isDraggingFile ? "border-2 border-dashed border-marigold bg-marigold/10" : "border-rule"}`}
      >
        <EditorContent editor={editor} />
        {isDraggingFile && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-white/80">
            <p className="rounded-lg border border-marigold bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm">
              {noteId ? "Drop to attach and insert" : "Save the note once before dragging files in"}
            </p>
          </div>
        )}
        {uploadingCount > 0 && (
          <div className="pointer-events-none absolute bottom-3 right-3 rounded-lg border border-rule bg-white px-3 py-1.5 text-xs font-medium text-ink-soft shadow-sm">
            Uploading {uploadingCount} file{uploadingCount === 1 ? "" : "s"}…
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-ink-soft">
        Images, videos, and other uploaded resources are attached separately after publishing — use
        &quot;Insert resource&quot; to place one at a specific point in the text, drag a file
        straight onto the editor to upload and insert it in one step, or &quot;Generate Mermaid
        diagram&quot; to create and insert a new diagram directly. Click the ∑ / ∑∑ buttons to add
        math, then click the equation to edit its LaTeX.
      </p>
      {error && <p className="mt-2 text-sm text-clay">{error}</p>}
    </div>
  );
}
