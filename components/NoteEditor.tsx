"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type DragEvent,
} from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent, useEditorState } from "@tiptap/react";
import { Extension, type Editor } from "@tiptap/core";
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
import { CodeBlock } from "@/lib/tiptap/code-block";
import "highlight.js/styles/github-dark.css";
import { Callout } from "@/lib/tiptap/callout-node";
import { Section, groupIntoSections } from "@/lib/tiptap/section-node";
import { BlockReorderShortcuts } from "@/lib/tiptap/block-reorder";
import { SlashCommand, slashCommandBridge } from "@/lib/tiptap/slash-command";
import { CharacterCount } from "@tiptap/extension-character-count";
import {
  HighlightMarkdown,
  SubscriptMarkdown,
  SuperscriptMarkdown,
  TextStyleMarkdown,
} from "@/lib/tiptap/format-marks";
import { Markdown } from "tiptap-markdown";
import "katex/dist/katex.min.css";
import {
  saveTopicNote,
  createMermaidResource,
  createVideoEmbedResource,
  uploadTopicResource,
  saveTopicNoteDraft,
  getTopicNoteDraft,
  clearTopicNoteDraft,
} from "@/lib/actions/teacher";
import { emitToast } from "@/lib/toast";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import { ResourceChip } from "@/lib/tiptap/resource-node";
import { EmojiPicker } from "@/components/EmojiPicker";
import { SymbolPicker } from "@/components/SymbolPicker";
import { clampPopoverToEditor } from "@/lib/tiptap/popover-position";
import {
  AddRowAboveIcon,
  AddRowBelowIcon,
  DeleteRowIcon,
  AddColLeftIcon,
  AddColRightIcon,
  DeleteColIcon,
  MergeCellsIcon,
  SplitCellIcon,
  HeaderRowIcon,
  DeleteTableIcon,
} from "@/components/TableIcons";
import { MathInline, MathBlock } from "@/lib/tiptap/math-nodes";
import type { TopicResource } from "@/types/database";

type SearchMatch = { from: number; to: number };

const RESOURCE_TYPE_LABEL: Record<TopicResource["resource_type"], string> = {
  image: "Image",
  diagram_mermaid: "Diagram",
  video: "Video",
  pdf: "PDF",
  link: "Link",
  audio: "Audio",
};

const DEFAULT_MERMAID = "flowchart TD\n  A[Start] --> B[End]";
const TEXT_COLORS = ["#1f2937", "#475569", "#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#0891b2", "#2563eb", "#4f46e5", "#7c3aed", "#c026d3", "#db2777"];

// Starter templates for the "Generate Mermaid diagram" panel
const DIAGRAM_TEMPLATES: { label: string; code: string }[] = [
  {
    label: "Flowchart",
    code: "flowchart TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Do this]\n  B -->|No| D[Do that]",
  },
  {
    label: "Mind map",
    code: "mindmap\n  root((Topic))\n    Idea 1\n      Detail A\n      Detail B\n    Idea 2\n    Idea 3",
  },
  {
    label: "Timeline",
    code: "timeline\n  title A Sequence of Events\n  Step 1 : First thing happens\n  Step 2 : Then this\n  Step 3 : Finally this",
  },
  {
    label: "Cycle",
    code: "flowchart LR\n  A[Stage 1] --> B[Stage 2]\n  B --> C[Stage 3]\n  C --> D[Stage 4]\n  D --> A",
  },
  {
    label: "Org chart",
    code: "flowchart TD\n  Head[Head Teacher]\n  Head --> A[Deputy A]\n  Head --> B[Deputy B]\n  A --> A1[Teacher]\n  B --> B1[Teacher]",
  },
  {
    label: "Sequence diagram",
    code: "sequenceDiagram\n  participant Teacher\n  participant Student\n  Teacher->>Student: Asks a question\n  Student-->>Teacher: Gives an answer",
  },
];

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

const TabTrap = Extension.create({
  name: "tabTrap",
  addKeyboardShortcuts() {
    return {
      Tab: () => true,
      "Shift-Tab": () => true,
    };
  },
});

// Wraps the document's top-level content into `Section` nodes -- the boxes
// with the drag handle/duplicate/delete controls in the editor. This has to
// run any time the doc is replaced wholesale (initial load, restoring an
// autosave draft), or the content renders flat with no section chrome.
function applySectionGrouping(editor: Editor) {
  const grouped = groupIntoSections(editor.schema, editor.state.doc);
  const tr = editor.state.tr.replaceWith(0, editor.state.doc.content.size, grouped.content);
  tr.setMeta("addToHistory", false);
  editor.view.dispatch(tr);
}

export function NoteEditor({
  topicId,
  noteId,
  initialContent,
  initialStatus,
  resources = [],
  placeholder = "Write the topic explanation here. Use tables for summaries, and the ∑ button for math.",
}: {
  topicId: string;
  noteId?: string;
  initialContent: string;
  initialStatus: "draft" | "published" | "archived" | "unwritten";
  resources?: TopicResource[];
  placeholder?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [symbolPickerOpen, setSymbolPickerOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  // Set only when the picker is opened via the slash command -- gives it a
  // cursor-anchored `position: fixed` spot instead of the toolbar-anchored
  // dropdown, so picking an emoji while typing deep in a long note doesn't
  // require jumping your eyes up to the toolbar and back. Left `null` for
  // the toolbar button's own click, which anchors to itself instead (you
  // just clicked it, so it's already where you're looking).
  const [emojiPickerPos, setEmojiPickerPos] = useState<{ top: number; left: number } | null>(null);
  const [diagramPanelOpen, setDiagramPanelOpen] = useState(false);
  const [videoEmbedOpen, setVideoEmbedOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [isSavingVideoEmbed, setIsSavingVideoEmbed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [replaceTerm, setReplaceTerm] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  useEffect(() => {
    slashCommandBridge.openResourcePicker = () => setPickerOpen(true);
    slashCommandBridge.openDiagramPanel = () => setDiagramPanelOpen(true);
  });
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
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);
  const symbolPickerRef = useRef<HTMLDivElement | null>(null);
  const colorPickerRef = useRef<HTMLDivElement | null>(null);
  const emojiPopupRef = useRef<HTMLDivElement | null>(null);
  const diagramSectionRef = useRef<HTMLDivElement | null>(null);
  const noteContainerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // The resource picker still needs the old scroll-to-toolbar treatment --
  // it has no cursor-relative anchor point the way emoji insertion does
  // (you're picking a whole attachment, not something that lands at the
  // caret), so bringing the toolbar into view is the right fix there.
  useEffect(() => {
    if (pickerOpen) pickerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [pickerOpen]);

  useEffect(() => {
    if (diagramPanelOpen) {
      diagramSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [diagramPanelOpen]);

  const [currentNoteId, setCurrentNoteId] = useState(noteId);
  useEffect(() => setCurrentNoteId(noteId), [noteId]);

  const [localResources, setLocalResources] = useState(resources);
  // NOT a plain `setLocalResources(resources)` -- ensureNoteId() calls
  // router.refresh() when it creates the note (e.g. the first thing
  // saved in a fresh note is a Diagram), and that refresh's server
  // snapshot is taken *before* the resource that triggered it exists.
  // If it lands after createMermaidResource()/insertResourceMarker()
  // have already added the resource locally, a blind overwrite here
  // erases it again -- the chip's NodeView then finds no match on its
  // next render and falls back to "Missing resource", which also makes
  // its edit-title UI unreachable (ResourceChipDefaultView only renders
  // the rename form when `resource` is non-null). Merging keeps any
  // local-only resource until a later, genuinely up-to-date refresh
  // includes it from the server.
  useEffect(() => {
    setLocalResources((prev) => {
      const incomingIds = new Set(resources.map((r) => r.id));
      const localOnly = prev.filter((r) => !incomingIds.has(r.id));
      return [...resources, ...localOnly];
    });
  }, [resources]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      TabTrap,
      BlockReorderShortcuts,
      StarterKit.configure({
        link: { openOnClick: false, autolink: true },
        codeBlock: false,
      }),
      CodeBlock,
      Callout,
      Section,
      SlashCommand,
      CharacterCount,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({
        placeholder,
      }),
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
      Markdown.configure({
        html: false,
        transformPastedText: true,
      }),
    ],
    content: initialContent,
    // @ts-expect-error -- provided by the Markdown extension
    contentType: "markdown",
    editorProps: {
      handlePaste(_view, event) {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) =>
          f.type.startsWith("image/")
        );
        if (files.length === 0) return false; // let normal paste handling run
        event.preventDefault();
        void uploadDroppedFiles(files);
        return true;
      },
    },

    onCreate({ editor: created }) {
      requestAnimationFrame(() => {
        applySectionGrouping(created);
      });
    },
  });

  useEditorState({
    editor,
    selector: ({ editor }) => editor?.state,
  });

  // Keep positions rather than decorating every result: a selection is
  // enough to show the active match, and it avoids modifying a teacher's
  // document merely to display search results.
  function getSearchMatches(): SearchMatch[] {
    if (!editor || !searchTerm) return [];
    const needle = matchCase ? searchTerm : searchTerm.toLocaleLowerCase();
    const matches: SearchMatch[] = [];

    editor.state.doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return true;
      const haystack = matchCase ? node.text : node.text.toLocaleLowerCase();
      let index = haystack.indexOf(needle);
      while (index !== -1) {
        matches.push({ from: pos + index, to: pos + index + searchTerm.length });
        index = haystack.indexOf(needle, index + searchTerm.length);
      }
      return true;
    });
    return matches;
  }

  const searchMatches = getSearchMatches();

  function selectSearchMatch(direction: 1 | -1 = 1) {
    if (!editor || searchMatches.length === 0) return;
    const { from, to } = editor.state.selection;
    const selectedIndex = searchMatches.findIndex(
      (match) => match.from === from && match.to === to
    );
    const nextIndex =
      selectedIndex === -1
        ? direction === 1
          ? 0
          : searchMatches.length - 1
        : (selectedIndex + direction + searchMatches.length) % searchMatches.length;
    const match = searchMatches[nextIndex];
    editor.chain().focus().setTextSelection(match).scrollIntoView().run();
  }

  function replaceSearchMatch() {
    if (!editor || searchMatches.length === 0) return;
    const { from, to } = editor.state.selection;
    const match =
      searchMatches.find((candidate) => candidate.from === from && candidate.to === to) ??
      searchMatches[0];
    const chain = editor.chain().focus().setTextSelection(match);
    if (replaceTerm) chain.insertContent(replaceTerm);
    else chain.deleteSelection();
    chain.scrollIntoView().run();
  }

  function replaceAllSearchMatches() {
    if (!editor || searchMatches.length === 0) return;
    // Work backwards so each replacement leaves the positions of earlier
    // matches valid. One transaction also makes Replace all one undo step.
    let transaction = editor.state.tr;
    for (const match of [...searchMatches].reverse()) {
      transaction = transaction.insertText(replaceTerm, match.from, match.to);
    }
    editor.view.dispatch(transaction);
    editor.commands.focus();
  }

  function enterFocusMode() {
    setSearchOpen(false);
    setPickerOpen(false);
    setEmojiPickerOpen(false);
    setSymbolPickerOpen(false);
    setColorPickerOpen(false);
    setDiagramPanelOpen(false);
    setVideoEmbedOpen(false);
    setFocusMode(true);
    requestAnimationFrame(() => editor?.commands.focus());
  }

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    slashCommandBridge.openEmojiPicker = () => {
      // Read the caret's on-screen position right now, before React
      // re-renders -- `editor.state.selection` reflects the document as it
      // stands the instant this runs (the slash command's own deleteRange
      // has already landed the cursor where "/emoji" used to be).
      const pos = editor?.state.selection.from;
      if (editor && pos != null) {
        const coords = editor.view.coordsAtPos(pos);
        setEmojiPickerPos({ left: coords.left, top: coords.bottom + 6 });
      } else {
        setEmojiPickerPos(null);
      }
      setEmojiPickerOpen(true);
    };
  });

  // Re-clamp the cursor-anchored emoji popup inside the editor's bounds
  // whenever it opens -- same reasoning and helper as MathInline's floating
  // popup (see math-nodes.tsx): opening near the editor's right/bottom edge
  // would otherwise render partly off the visible note.
  useLayoutEffect(() => {
    if (emojiPickerOpen && emojiPickerPos && emojiPopupRef.current) {
      clampPopoverToEditor(emojiPopupRef.current, editor?.view?.dom ?? null);
    }
  }, [emojiPickerOpen, emojiPickerPos, editor]);

  useEffect(() => {
    if (!editor) return;
    editor.storage.resourceChip.resources = localResources;
    editor.storage.resourceChip.onResourceUpdated = (updated: TopicResource) => {
      setLocalResources((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    };
  }, [editor, localResources]);

  const getMarkdown = () => (editor as any)?.storage.markdown.getMarkdown() as string;

  // The mobile Write/Preview toggle only renders below `md` (the tab bar
  // itself is `md:hidden`), so this never fires from user interaction on
  // desktop — mobileTab stays "write" there and editing is unaffected.
  // Toggling real editability (not just a cosmetic class) is what makes
  // "Preview" an actual read view: same TipTap content/node-views (tables,
  // images, Mermaid, resource chips) render identically, just without a
  // cursor or toolbar.
  useEffect(() => {
    editor?.setEditable(mobileTab !== "preview");
  }, [editor, mobileTab]);

  function computeNoteStats(ed: NonNullable<typeof editor>) {
    let headings = 0;
    let tables = 0;
    let images = 0;
    let resources = 0;
    ed.state.doc.descendants((node) => {
      if (node.type.name === "heading") headings++;
      else if (node.type.name === "table") tables++;
      else if (node.type.name === "resourceChip") {
        resources++;
        const resource = localResources.find((r) => r.id === node.attrs.id);
        if (resource?.resource_type === "image") images++;
      }
      return true;
    });
    const words: number = ed.storage.characterCount.words();
    const characters: number = ed.storage.characterCount.characters();
    // 200 wpm is the commonly-cited average adult silent-reading speed --
    // good enough for a rough "how long will this take a student to
    // read" estimate, not meant to be precise.
    const readingMinutes = Math.max(1, Math.round(words / 200));
    return { words, characters, readingMinutes, headings, tables, images, resources };
  }

  const initialMarkdown = useMemo(() => initialContent, [initialContent]);
  const [lastSavedContent, setLastSavedContent] = useState(initialMarkdown);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

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

  // --- Offline detection --------------------------------------
  // Autosave and the explicit Save/Publish buttons both need to know
  // this: there's no point firing a save attempt (autosave) or letting
  // someone click Publish (explicit) when the request can't possibly
  // reach the server, and either would otherwise surface as a confusing
  // generic network-error toast rather than the clearer "you're offline"
  // state this drives instead.
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    setIsOnline(navigator.onLine);
    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // --- Periodic autosave ---------------------------------------
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [lastAutosaveAt, setLastAutosaveAt] = useState<Date | null>(null);
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;

  useEffect(() => {
    if (!editor) return;
    const interval = setInterval(() => {
      if (!isDirtyRef.current || !isOnlineRef.current) return;
      const content = getMarkdown();
      setAutosaveStatus("saving");
      saveTopicNoteDraft(topicId, content)
        .then(() => {
          setAutosaveStatus("saved");
          setLastAutosaveAt(new Date());
        })
        .catch(() => {
          setAutosaveStatus("error");
        });
    }, 20_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, topicId]);

  // --- Draft recovery banner -----------------------------------
  // Checked once on mount. The existing `beforeunload` warning only
  // catches a clean in-app navigation attempt -- it can't do anything
  // about a crashed tab, a dead battery, or a network drop right as
  // someone closed the laptop lid. If an autosave tick from one of those
  // situations is sitting in `topic_note_drafts` and differs from what
  // this page loaded with, offer to restore it instead of silently
  // discarding a teacher's unsaved work.
  const [draftBanner, setDraftBanner] = useState<{ content: string; updatedAt: string } | null>(
    null
  );
  useEffect(() => {
    let cancelled = false;
    getTopicNoteDraft(topicId)
      .then((draft) => {
        if (!cancelled && draft && draft.content !== initialMarkdown) {
          setDraftBanner(draft);
        }
      })
      .catch(() => {
        // No draft, or couldn't check -- fine either way, nothing to recover.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId]);

  function restoreDraft() {
    if (!editor || !draftBanner) return;
    editor.commands.setContent(draftBanner.content);
    // setContent parses the raw markdown flat -- re-apply the same
    // section-grouping pass used on initial load, or the section
    // boxes/controls vanish even though the content itself is intact.
    requestAnimationFrame(() => {
      applySectionGrouping(editor);
    });
    setDraftBanner(null);
  }

  function discardDraft() {
    setDraftBanner(null);
    clearTopicNoteDraft(topicId).catch(() => {
      // Non-critical -- worst case the banner reappears next load.
    });
  }

  function handleSave(status: "draft" | "published") {
    if (!editor) return;
    if (!isOnline) {
      emitToast("You're offline — reconnect before saving.", "error");
      return;
    }
    setError(null);
    if (status === "draft") setIsSavingDraft(true);
    const content = getMarkdown();
    const isFirstSave = !currentNoteId;
    startTransition(async () => {
      try {
        const note = await saveTopicNote(topicId, content, status);
        // Not `if (isFirstSave)` -- notes are append-only (see
        // saveTopicNote's own comment: "publishing a revision never
        // overwrites an earlier draft or published copy"), so *every*
        // save inserts a brand-new row with a brand-new id, not just the
        // first. Any resource created after this point goes through
        // ensureNoteId(), which returns currentNoteId as-is if it's
        // already set -- so a stale id here silently attaches every
        // subsequent diagram/upload to a superseded note version. The
        // page always queries the *latest* version's resources
        // (`.eq("note_id", note.id)` in page.tsx, intentionally scoped
        // per note version, not per topic), so a resource attached to a
        // stale id becomes permanently invisible the moment a newer
        // version exists -- not just "not refreshed yet", genuinely
        // orphaned in the database. This was the real cause of
        // resources -- including ones from well before this session --
        // silently disappearing after any second save.
        if (note?.id) setCurrentNoteId(note.id);
        setLastSavedContent(content);
        setLastSavedAt(new Date());
        setIsDirty(false);
        emitToast(status === "published" ? "Topic note published." : "Draft saved.");
        if (isFirstSave) router.refresh();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unable to save the topic note.";
        setError(message);
        emitToast(message, "error");
      } finally {
        setIsSavingDraft(false);
      }
    });
  }

  async function ensureNoteId(): Promise<string> {
    if (currentNoteId) return currentNoteId;
    if (!editor) throw new Error("Editor isn't ready yet.");
    const note = await saveTopicNote(topicId, getMarkdown(), "draft");
    if (!note?.id) throw new Error("Could not create the note.");
    setCurrentNoteId(note.id);
    setLastSavedContent(getMarkdown());
    setLastSavedAt(new Date());
    setIsDirty(false);
    router.refresh();
    return note.id;
  }

  async function handleInsertVideoEmbed() {
    if (!videoUrl.trim()) {
      emitToast("Paste a YouTube or Vimeo URL first.", "error");
      return;
    }
    setIsSavingVideoEmbed(true);
    try {
      const savedNoteId = await ensureNoteId();
      const resource = await createVideoEmbedResource(topicId, savedNoteId, videoUrl, videoTitle);
      setLocalResources((previous) => [...previous, resource]);
      insertResourceMarker(resource);
      setVideoUrl("");
      setVideoTitle("");
      setVideoEmbedOpen(false);
      emitToast("Video embedded.");
    } catch (err: unknown) {
      emitToast(err instanceof Error ? err.message : "Unable to embed the video.", "error");
    } finally {
      setIsSavingVideoEmbed(false);
    }
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

  useEffect(() => {
    if (!emojiPickerOpen) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      // The cursor-anchored popup (emojiPopupRef) renders outside the
      // toolbar wrapper's DOM subtree via `position: fixed`, so a click
      // inside it wouldn't register as "inside emojiPickerRef" -- check
      // both, or picking an emoji from the floating popup would
      // immediately close itself before onSelect's own close ever ran.
      const insideToolbarAnchor = emojiPickerRef.current?.contains(target);
      const insideFloatingPopup = emojiPopupRef.current?.contains(target);
      if (!insideToolbarAnchor && !insideFloatingPopup) {
        setEmojiPickerOpen(false);
        setEmojiPickerPos(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [emojiPickerOpen]);

  useEffect(() => {
    if (!symbolPickerOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (symbolPickerRef.current && !symbolPickerRef.current.contains(e.target as Node))
        setSymbolPickerOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [symbolPickerOpen]);

  useEffect(() => {
    if (!colorPickerOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node))
        setColorPickerOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [colorPickerOpen]);

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

  // Ctrl/Cmd+S saves a draft, Ctrl/Cmd+K opens links, Ctrl/Cmd+F opens
  // search, and Ctrl/Cmd+/ inserts the slash that activates the existing
  // TipTap suggestion menu. Ctrl/Cmd+B and +I are StarterKit keymaps.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && focusMode && !searchOpen) {
        setFocusMode(false);
        return;
      }
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "s") {
        e.preventDefault();
        handleSave("draft");
      } else if (e.key === "k") {
        e.preventDefault();
        promptForLink();
      } else if (e.key === "f") {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === "/" || e.code === "Slash") {
        if (!editor?.view.dom.contains(e.target as Node)) return;
        e.preventDefault();
        editor.chain().focus().insertContent("/").run();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, focusMode, searchOpen]);

  function insertResourceMarker(resource: TopicResource) {
    const storage = editor?.storage.resourceChip;
    if (storage && !storage.resources.some((r) => r.id === resource.id)) {
      storage.resources = [...storage.resources, resource];
    }
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

  function insertEmoji(emoji: string) {
    // Emoji are just Unicode text, not a custom node -- inserting as
    // plain content means they round-trip through markdown for free
    // (no serialize/parse wiring needed, unlike MathInline/ResourceChip).
    editor?.chain().focus().insertContent(emoji).run();
    setEmojiPickerOpen(false);
    setEmojiPickerPos(null);
  }

  function insertSymbol(symbol: string) {
    editor?.chain().focus().insertContent(symbol).run();
    setSymbolPickerOpen(false);
  }

  function insertMath(displayMode: boolean) {
    editor
      ?.chain()
      .focus()
      .insertContent({ type: displayMode ? "mathBlock" : "mathInline", attrs: { latex: "" } })
      .run();
  }

  async function handleSaveDiagram() {
    if (!diagramCode.trim()) {
      emitToast("Write some Mermaid code before saving.", "error");
      return;
    }
    setIsSavingDiagram(true);
    try {
      const neededNoteCreation = !currentNoteId;
      const noteIdToUse = await ensureNoteId();
      const resource = await createMermaidResource(
        topicId,
        noteIdToUse,
        diagramTitle || "Diagram",
        diagramCode
      );
      setLocalResources((prev) => [...prev, resource]);
      insertResourceMarker(resource);
      if (neededNoteCreation) {
        const content = getMarkdown();
        await saveTopicNote(topicId, content, "draft");
        setLastSavedContent(content);
        setIsDirty(false);
      }
      // ensureNoteId() already refreshes when it creates the note, but
      // that's a different case (note didn't exist) from this one (note
      // exists, a new resource was just added to it) -- without this,
      // the sidebar TopicResourceList (page.tsx, fed from the Server
      // Component's own `resources` prop, with zero connection to this
      // component's client state) never learns the diagram exists until
      // an unrelated navigation happens to reload the page. The earlier
      // merge-not-overwrite fix on the `resources` prop-sync effect
      // above is what makes calling this safe every time: a stale
      // snapshot arriving mid-flight can no longer erase what was just
      // added locally.
      router.refresh();
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

  async function uploadDroppedFiles(files: File[]) {
    const accepted = files.filter((f) => ACCEPTED_RESOURCE_MIME_TYPES.has(f.type));
    const rejected = files.length - accepted.length;
    if (rejected > 0) {
      emitToast(
        `${rejected} file${rejected === 1 ? "" : "s"} skipped -- use an image, PDF, audio, or video file.`,
        "error"
      );
    }
    if (accepted.length === 0) return;

    const neededNoteCreation = !currentNoteId;
    let noteIdToUse: string;
    try {
      noteIdToUse = await ensureNoteId();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not create the note.";
      emitToast(message, "error");
      return;
    }

    setUploadingCount(accepted.length);
    let failures = 0;
    let insertedAny = false;
    for (const file of accepted) {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("title", "");
      try {
        const resource = await uploadTopicResource(topicId, noteIdToUse, formData);
        if (resource) {
          setLocalResources((prev) => [...prev, resource]);
          insertResourceMarker(resource);
          insertedAny = true;
        }
      } catch (err: unknown) {
        failures += 1;
        const message = err instanceof Error ? err.message : `Could not upload "${file.name}".`;
        emitToast(message, "error");
      } finally {
        setUploadingCount((count) => Math.max(0, count - 1));
      }
    }
    if (neededNoteCreation && insertedAny) {
      // One save for the whole batch
      const content = getMarkdown();
      await saveTopicNote(topicId, content, "draft");
      setLastSavedContent(content);
      setIsDirty(false);
    }
    // Same reasoning as handleSaveDiagram's router.refresh() -- the
    // sidebar TopicResourceList only ever updates via a server
    // round-trip, and ensureNoteId()'s refresh only covers the
    // note-didn't-exist case, not "note exists, files were just
    // uploaded to it".
    if (insertedAny) router.refresh();
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

  return (
    <div
      suppressHydrationWarning
      className={
        focusMode ? "fixed inset-0 z-50 overflow-y-auto bg-paper px-4 py-6 sm:px-8" : undefined
      }
    >
      {!editor ? (
        <div className="min-h-[24rem] animate-pulse rounded-lg border border-rule bg-white p-4" />
      ) : (
        <>
          {focusMode && (
            <button
              type="button"
              onClick={() => setFocusMode(false)}
              className="fixed right-4 top-4 z-10 rounded-lg border border-rule bg-white px-3 py-1.5 text-sm font-medium text-ink shadow-sm hover:bg-paper"
            >
              Exit focus mode <span className="text-ink-soft">Esc</span>
            </button>
          )}

          {!focusMode && !isOnline && (
            <div className="mb-3 rounded-lg border border-clay/40 bg-clay/10 px-3 py-2 text-sm text-clay">
              You&apos;re offline — changes aren&apos;t being saved. Reconnect to save or publish.
            </div>
          )}

          {!focusMode && draftBanner && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-marigold/50 bg-marigold/10 px-3 py-2 text-sm text-ink">
              <span>
                Found unsaved changes from{" "}
                {new Date(draftBanner.updatedAt).toLocaleString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                  month: "short",
                  day: "numeric",
                })}{" "}
                — probably from a tab that closed before you could save.
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  onClick={restoreDraft}
                  className="rounded-lg bg-marigold px-3 py-1 text-xs font-medium text-ink hover:bg-marigold-dark"
                >
                  Restore
                </button>
                <button
                  type="button"
                  onClick={discardDraft}
                  className="rounded-lg border border-rule px-3 py-1 text-xs text-ink-soft hover:bg-white"
                >
                  Discard
                </button>
              </span>
            </div>
          )}

          {!focusMode && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-wide text-ink-soft">
                Currently: {initialStatus}
                {isDirty && (
                  <span className="ml-2 normal-case text-marigold-dark">Unsaved changes</span>
                )}
                {isSavingDraft && <span className="ml-2 normal-case">Saving…</span>}
                {!isSavingDraft && lastSavedAt && (
                  <span className="ml-2 normal-case">
                    Last saved{" "}
                    {lastSavedAt.toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                )}
                {isDirty && autosaveStatus === "saved" && lastAutosaveAt && (
                  <span className="ml-2 normal-case text-ink-soft/70">
                    (autosaved{" "}
                    {lastAutosaveAt.toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    )
                  </span>
                )}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative" ref={pickerRef}>
                  <button
                    type="button"
                    onClick={() => setPickerOpen((open) => !open)}
                    disabled={isPending || localResources.length === 0}
                    className="rounded-lg border border-rule px-3 py-1.5 text-sm text-ink hover:bg-paper disabled:opacity-60"
                    title={
                      localResources.length === 0
                        ? "No resources attached to this topic yet"
                        : undefined
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
                  disabled={isPending}
                  className="rounded-lg border border-rule px-3 py-1.5 text-sm text-ink hover:bg-paper disabled:opacity-60"
                >
                  Generate Mermaid diagram
                </button>
                <button
                  type="button"
                  onClick={() => setVideoEmbedOpen((open) => !open)}
                  disabled={isPending}
                  className="rounded-lg border border-rule px-3 py-1.5 text-sm text-ink hover:bg-paper disabled:opacity-60"
                >
                  Embed video
                </button>

                <button
                  onClick={() => handleSave("draft")}
                  disabled={isPending || !isOnline}
                  title={!isOnline ? "You're offline" : "Save draft (Ctrl/Cmd+S)"}
                  className="rounded-lg border border-rule px-3 py-1.5 text-sm text-ink hover:bg-paper disabled:opacity-60"
                >
                  {isSavingDraft ? "Saving…" : "Save draft"}
                </button>
                <button
                  onClick={() => handleSave("published")}
                  disabled={isPending || !isOnline}
                  title={!isOnline ? "You're offline" : undefined}
                  className="rounded-lg bg-marigold px-3 py-1.5 text-sm font-medium text-ink hover:bg-marigold-dark disabled:opacity-60"
                >
                  Publish
                </button>
              </div>
            </div>
          )}

          {!focusMode && videoEmbedOpen && (
            <section className="mb-4 rounded-xl border border-rule bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold text-ink">Embed video</h3>
                <button
                  type="button"
                  onClick={() => setVideoEmbedOpen(false)}
                  className="text-xs text-ink-soft hover:underline"
                >
                  Close
                </button>
              </div>
              <p className="mb-3 text-sm text-ink-soft">
                Paste a YouTube or Vimeo link. Uploaded video files remain available through Insert
                resource.
              </p>
              <input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
                type="url"
                className="mb-2 w-full rounded-lg border border-rule p-2 text-sm outline-none focus-visible:border-marigold"
              />
              <input
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
                placeholder="Video title (optional)"
                className="w-full rounded-lg border border-rule p-2 text-sm outline-none focus-visible:border-marigold"
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleInsertVideoEmbed}
                  disabled={isSavingVideoEmbed}
                  className="rounded-lg bg-marigold px-3 py-1.5 text-sm font-medium text-ink hover:bg-marigold-dark disabled:opacity-60"
                >
                  {isSavingVideoEmbed ? "Embedding…" : "Insert video"}
                </button>
              </div>
            </section>
          )}

          {!focusMode && diagramPanelOpen && (
            <section
              ref={diagramSectionRef}
              className="mb-4 rounded-xl border border-rule bg-white p-4"
            >
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
              <div className="mb-3">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft">
                  Start from a template
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {DIAGRAM_TEMPLATES.map((template) => (
                    <button
                      key={template.label}
                      type="button"
                      onClick={() => setDiagramCode(template.code)}
                      className="rounded-full border border-rule px-2.5 py-1 text-xs text-ink hover:border-marigold hover:bg-paper"
                    >
                      {template.label}
                    </button>
                  ))}
                </div>
              </div>
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

          {/* Mobile write/preview toggle — md:hidden, desktop always shows toolbar + editable view */}
          {!focusMode && searchOpen && (
            <section
              className="mb-3 rounded-lg border border-rule bg-paper p-3"
              aria-label="Search and replace"
            >
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor="note-search">
                  Find text
                </label>
                <input
                  ref={searchInputRef}
                  id="note-search"
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      selectSearchMatch(e.shiftKey ? -1 : 1);
                    } else if (e.key === "Escape") {
                      setSearchOpen(false);
                      editor.commands.focus();
                    }
                  }}
                  placeholder="Find"
                  className="min-w-40 flex-1 rounded-md border border-rule bg-white px-2.5 py-1.5 text-sm text-ink outline-none focus-visible:border-marigold"
                />
                <span className="min-w-16 text-center text-xs text-ink-soft" aria-live="polite">
                  {searchTerm
                    ? `${searchMatches.length} match${searchMatches.length === 1 ? "" : "es"}`
                    : "Find text"}
                </span>
                <button
                  type="button"
                  onClick={() => selectSearchMatch(-1)}
                  disabled={searchMatches.length === 0}
                  className="rounded-md border border-rule bg-white px-2.5 py-1.5 text-sm text-ink hover:bg-white/70 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => selectSearchMatch(1)}
                  disabled={searchMatches.length === 0}
                  className="rounded-md border border-rule bg-white px-2.5 py-1.5 text-sm text-ink hover:bg-white/70 disabled:opacity-40"
                >
                  Next
                </button>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-soft">
                  <input
                    type="checkbox"
                    checked={matchCase}
                    onChange={(e) => setMatchCase(e.target.checked)}
                    className="accent-marigold"
                  />
                  Match case
                </label>
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="ml-auto rounded-md px-2 py-1.5 text-xs text-ink-soft hover:bg-white hover:text-ink"
                >
                  Close
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor="note-replace">
                  Replace with
                </label>
                <input
                  id="note-replace"
                  type="text"
                  value={replaceTerm}
                  onChange={(e) => setReplaceTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setSearchOpen(false);
                      editor.commands.focus();
                    }
                  }}
                  placeholder="Replace with"
                  className="min-w-40 flex-1 rounded-md border border-rule bg-white px-2.5 py-1.5 text-sm text-ink outline-none focus-visible:border-marigold"
                />
                <button
                  type="button"
                  onClick={replaceSearchMatch}
                  disabled={searchMatches.length === 0}
                  className="rounded-md border border-rule bg-white px-2.5 py-1.5 text-sm text-ink hover:bg-white/70 disabled:opacity-40"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={replaceAllSearchMatches}
                  disabled={searchMatches.length === 0}
                  className="rounded-md bg-marigold px-2.5 py-1.5 text-sm font-medium text-ink hover:bg-marigold-dark disabled:opacity-40"
                >
                  Replace all
                </button>
              </div>
            </section>
          )}

          {!focusMode && (
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
          )}

          {/* Toolbar — hidden on mobile while previewing; always shown on desktop */}
          {!focusMode && (
            <div
              className={`mb-2 ${mobileTab === "preview" ? "hidden md:flex" : "flex"} flex-wrap items-center gap-1 rounded-lg border border-rule bg-paper p-1`}
            >
              <button
                type="button"
                title="Undo (Ctrl/Cmd+Z)"
                onClick={() => editor.chain().focus().undo().run()}
                className="min-w-[2rem] rounded-md px-2 py-1 text-sm hover:bg-white"
              >
                ↺
              </button>
              <button
                type="button"
                title="Redo (Ctrl/Cmd+Shift+Z)"
                onClick={() => editor.chain().focus().redo().run()}
                className="min-w-[2rem] rounded-md px-2 py-1 text-sm hover:bg-white"
              >
                ↻
              </button>
              <span className="mx-1 h-4 w-px bg-rule" />
              <button
                type="button"
                title="Search and replace (Ctrl/Cmd+F)"
                onClick={() => setSearchOpen(true)}
                aria-label="Search and replace"
                className={`min-w-[2rem] rounded-md px-2 py-1 text-sm hover:bg-white ${searchOpen ? "bg-white" : ""}`}
              >
                <span aria-hidden="true"> Find ⌕</span>
              </button>
              <button
                type="button"
                title="Focus mode"
                aria-label="Enter focus mode"
                onClick={enterFocusMode}
                className="min-w-[2rem] rounded-md px-2 py-1 text-sm hover:bg-white"
              >
                <span aria-hidden="true">⛶</span>
              </button>
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
              <div className="relative" ref={colorPickerRef}>
                <button
                  type="button"
                  title="Text color"
                  aria-label="Choose text color"
                  onClick={() => setColorPickerOpen((open) => !open)}
                  className={`relative min-w-[2rem] rounded-md px-2 py-1 text-sm hover:bg-white ${colorPickerOpen ? "bg-white" : ""}`}
                >
                  A
                  <span
                    className="absolute bottom-0.5 left-2 right-2 h-0.5 rounded"
                    style={{
                      backgroundColor: editor.getAttributes("textStyle").color || "#1f2937",
                    }}
                  />
                </button>
                {colorPickerOpen && (
                  <div className="absolute left-0 top-full z-20 mt-1 w-44 rounded-lg border border-rule bg-white p-2 shadow-lg">
                    <div className="mb-2 flex items-center justify-between px-0.5"><span className="text-xs font-medium text-ink">Text color</span><button type="button" onClick={() => { editor.chain().focus().unsetColor().run(); setColorPickerOpen(false); }} className="text-xs text-ink-soft hover:text-ink">Reset</button></div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {TEXT_COLORS.map((color) => {
                        const selected = editor.getAttributes("textStyle").color === color;
                        return <button key={color} type="button" aria-label={`Set text color to ${color}`} title={color} onClick={() => { editor.chain().focus().setColor(color).run(); setColorPickerOpen(false); }} className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${selected ? "border-ink ring-2 ring-marigold/40" : "border-white hover:border-rule"}`} style={{ backgroundColor: color }}>
                          {selected && <span className="text-xs font-bold text-white">✓</span>}
                        </button>;
                      })}
                    </div>
                  </div>
                )}
              </div>
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
              <span className="mx-1 h-4 w-px bg-rule" />
              {false && (
                <>
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
                </>
              )}
              <span className="mx-1 h-4 w-px bg-rule" />
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
                title="Code block"
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                className={`min-w-[2rem] rounded-md px-2 py-1 font-mono text-sm hover:bg-white ${editor.isActive("codeBlock") ? "bg-white" : ""}`}
              >
                {"</>"}
              </button>
              <span className="mx-1 h-4 w-px bg-rule" />
              <button
                type="button"
                title="Callout (Tip/Warning/etc. — type '/' for more options)"
                onClick={() =>
                  editor
                    .chain()
                    .focus()
                    .insertContent({
                      type: "callout",
                      attrs: { calloutType: "tip" },
                      content: [{ type: "paragraph" }],
                    })
                    .run()
                }
                className={`min-w-[2rem] rounded-md px-2 py-1 text-sm hover:bg-white ${editor.isActive("callout") ? "bg-white" : ""}`}
              >
                💡
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
              <span className="mx-1 h-4 w-px bg-rule" />
              <div className="relative" ref={emojiPickerRef}>
                <button
                  type="button"
                  title="Insert emoji"
                  onClick={() => {
                    setEmojiPickerPos(null); // toolbar-anchored, not cursor-anchored
                    setEmojiPickerOpen((open) => !open);
                  }}
                  className={`min-w-[2rem] rounded-md px-2 py-1 text-sm hover:bg-white ${emojiPickerOpen ? "bg-white" : ""}`}
                >
                  😀
                </button>
                {emojiPickerOpen && !emojiPickerPos && (
                  <div className="absolute left-0 top-full z-20 mt-1">
                    <EmojiPicker onSelect={insertEmoji} />
                  </div>
                )}
              </div>
              <div className="relative" ref={symbolPickerRef}>
                <button
                  type="button"
                  title="Insert maths, science, or Greek symbol"
                  onClick={() => setSymbolPickerOpen((open) => !open)}
                  className={`min-w-[2rem] rounded-md px-2 py-1 text-sm hover:bg-white ${symbolPickerOpen ? "bg-white" : ""}`}
                >
                  Ω
                </button>
                {symbolPickerOpen && (
                  <div className="absolute right-0 top-full z-20 mt-1">
                    <SymbolPicker onSelect={insertSymbol} />
                  </div>
                )}
              </div>
              <button
                type="button"
                title="Slash commands (Ctrl/Cmd+/)"
                aria-label="Open slash commands"
                onClick={() => editor.chain().focus().insertContent("/").run()}
                className="min-w-[2rem] rounded-md px-2 py-1 font-mono text-sm hover:bg-white"
              >
                /
              </button>
            </div>
          )}

          {emojiPickerOpen && emojiPickerPos && (
            <div
              ref={emojiPopupRef}
              style={{ position: "fixed", left: emojiPickerPos.left, top: emojiPickerPos.top }}
              className="z-20"
            >
              <EmojiPicker onSelect={insertEmoji} />
            </div>
          )}

          {editor && (
            <BubbleMenu
              editor={editor}
              pluginKey="tableBubbleMenu"
              shouldShow={({ editor: e }) => e.isActive("table")}
              options={{
                placement: "top",
                offset: 10,
                flip: { boundary: noteContainerRef.current ?? "clippingAncestors", padding: 8 },
                shift: { boundary: noteContainerRef.current ?? "clippingAncestors", padding: 8 },
              }}
            >
              <div className="flex flex-wrap items-center gap-0.5 rounded-xl border border-rule/70 bg-white p-1.5 shadow-lg shadow-ink/10 ring-1 ring-ink/5">
                <span className="px-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                  Table
                </span>
                <span className="mx-0.5 h-5 w-px bg-rule/70" />

                <div className="flex items-center gap-0.5" role="group" aria-label="Row actions">
                  <button
                    type="button"
                    title="Add row above"
                    aria-label="Add row above"
                    onClick={() => editor.chain().focus().addRowBefore().run()}
                    className="rounded-md p-1.5 text-ink transition-colors hover:bg-paper active:bg-rule/30"
                  >
                    <AddRowAboveIcon />
                  </button>
                  <button
                    type="button"
                    title="Add row below"
                    aria-label="Add row below"
                    onClick={() => editor.chain().focus().addRowAfter().run()}
                    className="rounded-md p-1.5 text-ink transition-colors hover:bg-paper active:bg-rule/30"
                  >
                    <AddRowBelowIcon />
                  </button>
                  <button
                    type="button"
                    title="Delete row"
                    aria-label="Delete row"
                    onClick={() => editor.chain().focus().deleteRow().run()}
                    className="rounded-md p-1.5 text-red-600 transition-colors hover:bg-red-50 active:bg-red-100"
                  >
                    <DeleteRowIcon />
                  </button>
                </div>

                <span className="mx-1 h-5 w-px bg-rule/70" />

                <div className="flex items-center gap-0.5" role="group" aria-label="Column actions">
                  <button
                    type="button"
                    title="Add column left"
                    aria-label="Add column left"
                    onClick={() => editor.chain().focus().addColumnBefore().run()}
                    className="rounded-md p-1.5 text-ink transition-colors hover:bg-paper active:bg-rule/30"
                  >
                    <AddColLeftIcon />
                  </button>
                  <button
                    type="button"
                    title="Add column right"
                    aria-label="Add column right"
                    onClick={() => editor.chain().focus().addColumnAfter().run()}
                    className="rounded-md p-1.5 text-ink transition-colors hover:bg-paper active:bg-rule/30"
                  >
                    <AddColRightIcon />
                  </button>
                  <button
                    type="button"
                    title="Delete column"
                    aria-label="Delete column"
                    onClick={() => editor.chain().focus().deleteColumn().run()}
                    className="rounded-md p-1.5 text-red-600 transition-colors hover:bg-red-50 active:bg-red-100"
                  >
                    <DeleteColIcon />
                  </button>
                </div>

                <span className="mx-1 h-5 w-px bg-rule/70" />

                <div className="flex items-center gap-0.5" role="group" aria-label="Cell actions">
                  <button
                    type="button"
                    title="Merge cells"
                    aria-label="Merge cells"
                    disabled={!editor.can().mergeCells()}
                    onClick={() => editor.chain().focus().mergeCells().run()}
                    className="rounded-md p-1.5 text-ink transition-colors hover:bg-paper active:bg-rule/30 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <MergeCellsIcon />
                  </button>
                  <button
                    type="button"
                    title="Split cell"
                    aria-label="Split cell"
                    disabled={!editor.can().splitCell()}
                    onClick={() => editor.chain().focus().splitCell().run()}
                    className="rounded-md p-1.5 text-ink transition-colors hover:bg-paper active:bg-rule/30 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <SplitCellIcon />
                  </button>
                  <button
                    type="button"
                    title="Toggle header row"
                    aria-label="Toggle header row"
                    onClick={() => editor.chain().focus().toggleHeaderRow().run()}
                    className={`rounded-md p-1.5 transition-colors hover:bg-paper active:bg-rule/30 ${
                      editor.isActive("tableHeader") ? "bg-marigold/15 text-ink" : "text-ink"
                    }`}
                  >
                    <HeaderRowIcon />
                  </button>
                </div>

                <span className="mx-1 h-5 w-px bg-rule/70" />

                <button
                  type="button"
                  title="Delete table"
                  aria-label="Delete table"
                  onClick={() => editor.chain().focus().deleteTable().run()}
                  className="rounded-md p-1.5 text-red-600 transition-colors hover:bg-red-50 active:bg-red-100"
                >
                  <DeleteTableIcon />
                </button>
              </div>
            </BubbleMenu>
          )}

          {editor && (
            <BubbleMenu
              editor={editor}
              options={{
                placement: "top",
                offset: 10,
                flip: { boundary: noteContainerRef.current ?? "clippingAncestors", padding: 8 },
                shift: { boundary: noteContainerRef.current ?? "clippingAncestors", padding: 8 },
              }}
            >
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
          <div
            ref={noteContainerRef}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`topic-prose relative min-h-[24rem] bg-white p-4 ${
              focusMode
                ? "mx-auto mt-10 max-w-4xl rounded-lg border border-rule shadow-sm"
                : `rounded-lg border ${isDraggingFile ? "border-2 border-dashed border-marigold bg-marigold/10" : "border-rule"}`
            }`}
          >
            <EditorContent editor={editor} />
            {isDraggingFile && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-white/80">
                <p className="rounded-lg border border-marigold bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm">
                  Drop to attach and insert
                </p>
              </div>
            )}
            {uploadingCount > 0 && (
              <div className="pointer-events-none absolute bottom-3 right-3 rounded-lg border border-rule bg-white px-3 py-1.5 text-xs font-medium text-ink-soft shadow-sm">
                Uploading {uploadingCount} file{uploadingCount === 1 ? "" : "s"}…
              </div>
            )}
          </div>

          {editor && (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
              {(() => {
                const stats = computeNoteStats(editor);
                return (
                  <>
                    <span>
                      {stats.words} word{stats.words === 1 ? "" : "s"}
                    </span>
                    <span>
                      {stats.characters} character{stats.characters === 1 ? "" : "s"}
                    </span>
                    <span>~{stats.readingMinutes} min read</span>
                    {stats.headings > 0 && (
                      <span>
                        {stats.headings} heading{stats.headings === 1 ? "" : "s"}
                      </span>
                    )}
                    {stats.tables > 0 && (
                      <span>
                        {stats.tables} table{stats.tables === 1 ? "" : "s"}
                      </span>
                    )}
                    {stats.images > 0 && (
                      <span>
                        {stats.images} image{stats.images === 1 ? "" : "s"}
                      </span>
                    )}
                    {stats.resources > 0 && (
                      <span>
                        {stats.resources} resource{stats.resources === 1 ? "" : "s"}
                      </span>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          <p className="mt-3 text-xs text-ink-soft">
            Images, videos, and other uploaded resources are attached separately after publishing —
            use &quot;Insert resource&quot; to place one at a specific point in the text, drag a
            file straight onto the editor to upload and insert it in one step, or &quot;Generate
            Mermaid diagram&quot; to create and insert a new diagram directly. Click the ∑ / ∑∑
            buttons to add math, then click the equation to edit its LaTeX.
          </p>
          {error && <p className="mt-2 text-sm text-clay">{error}</p>}
        </>
      )}
    </div>
  );
}
