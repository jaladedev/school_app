"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
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
import { Section, applySectionGrouping } from "@/lib/tiptap/section-node";
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
  createLinkResource,
  uploadTopicResource,
} from "@/lib/actions/teacher";
import { emitToast } from "@/lib/toast";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import { ResourceChip } from "@/lib/tiptap/resource-node";
import { AssessmentChip, type LinkableAssessment } from "@/lib/tiptap/assessment-node";
import { TopicLinkChip, type LinkableTopic } from "@/lib/tiptap/topic-link-node";
import { EmojiPicker } from "@/components/EmojiPicker";
import { clampPopoverToEditor } from "@/lib/tiptap/popover-position";
import { useNoteAutosave } from "@/lib/hooks/useNoteAutosave";
import { useNoteSearch } from "@/lib/hooks/useNoteSearch";
import { NoteToolbar } from "@/components/NoteToolbar";
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

const RESOURCE_TYPE_LABEL: Record<TopicResource["resource_type"], string> = {
  image: "Image",
  diagram_mermaid: "Diagram",
  video: "Video",
  pdf: "PDF",
  link: "Link",
  audio: "Audio",
};

const DEFAULT_MERMAID = "flowchart TD\n  A[Start] --> B[End]";

// Used by the paste handler to decide whether a paste is "just a URL"
// (triggers the link-preview auto-fetch) versus a URL embedded in
// other text (pastes as plain text, unchanged). Deliberately narrower
// than a general URL-detection regex: the whole trimmed string must
// parse as one http(s) URL with nothing else around it.
function isBareHttpUrl(text: string): boolean {
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

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

// Imperative surface exposed to parents (namely `ResourceSidebar` via
// `NoteWorkspace`) so a persistent sidebar living outside this component
// can insert an existing resource or upload+insert a new one without
// duplicating `ensureNoteId`/`insertResourceMarker`/`uploadDroppedFiles`'s
// note-creation and refresh logic here.
export type NoteEditorHandle = {
  insertResource: (resource: TopicResource) => void;
  uploadFiles: (files: File[]) => Promise<void>;
};

type MobileTab = "write" | "preview" | "resources";

type NoteEditorProps = {
  topicId: string;
  noteId?: string;
  initialContent: string;
  initialStatus: "draft" | "published" | "archived" | "unwritten";
  resources?: TopicResource[];
  // Assessments available to link (not embed) into this note via #16's
  // AssessmentChip -- see lib/tiptap/assessment-node.tsx. Server-fetched,
  // scoped to the topic's subject (see page.tsx); unlike `resources`,
  // nothing here is ever created from inside the editor, so there's no
  // matching `onAssessmentsChange`/local-merge state the way resources
  // has for session-created uploads/diagrams.
  assessments?: LinkableAssessment[];
  // Other topics (same subject) available to link into this note via
  // TopicLinkChip -- see lib/tiptap/topic-link-node.tsx. Same shape as
  // `assessments`: server-fetched, nothing here is ever created from
  // inside the editor.
  topics?: LinkableTopic[];
  placeholder?: string;
  // Fired whenever the live (server + locally-created-this-session)
  // resource list changes, so a sidebar rendered by the parent can stay
  // in sync without waiting for a full `router.refresh()` round trip.
  onResourcesChange?: (resources: TopicResource[]) => void;
  // #32 Resources tab: the mobile Write/Preview/Resources tab bar lives
  // here (it's rendered alongside the toolbar), but the actual Resources
  // *content* is `ResourceSidebar`, which NoteWorkspace renders as a
  // sibling of this component, not a child -- so the "which tab is
  // active" state needs to live in NoteWorkspace and be passed down as a
  // controlled pair, rather than living only in this component's own
  // state, or NoteWorkspace would have no way to know when to show the
  // sidebar on mobile. Falls back to internal state if omitted, so this
  // component still works standalone / in tests without a parent wiring
  // this up.
  mobileTab?: MobileTab;
  onMobileTabChange?: (tab: MobileTab) => void;
  // #11 Better Preview: a desktop-visible, always-on read view, distinct
  // from the mobile-only Write/Preview tab bar above. NoteWorkspace owns
  // the mode switch (Edit/Preview/Present) and sets this when the
  // teacher picks "Preview" -- forces the same setEditable(false) the
  // mobile tab already used, but regardless of breakpoint, and hides the
  // toolbar/search/mobile-tab-bar chrome that a read-only view has no use
  // for instead of leaving them clickable over a non-editable doc.
  forcePreview?: boolean;
};

export const NoteEditor = forwardRef<NoteEditorHandle, NoteEditorProps>(function NoteEditor(
  {
    topicId,
    noteId,
    initialContent,
    initialStatus,
    resources = [],
    assessments = [],
    topics = [],
    placeholder = "Write the topic explanation here. Use tables for summaries, and the ∑ button for math.",
    onResourcesChange,
    mobileTab: controlledMobileTab,
    onMobileTabChange,
    forcePreview = false,
  },
  ref
) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [assessmentPickerOpen, setAssessmentPickerOpen] = useState(false);
  const [assessmentFilter, setAssessmentFilter] = useState("");
  const [topicPickerOpen, setTopicPickerOpen] = useState(false);
  const [topicFilter, setTopicFilter] = useState("");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [symbolPickerOpen, setSymbolPickerOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [a11yMenuOpen, setA11yMenuOpen] = useState(false);
  const a11yMenuRef = useRef<HTMLDivElement | null>(null);
  // Note-reading accessibility prefs (#37) -- a per-browser display
  // preference, not note content, so localStorage (not the DB) is the
  // right home for it: it should follow "how this teacher likes to
  // read/write," not travel with the note itself. Read lazily so SSR
  // and the first client render agree (no window on the server).
  const [fontScale, setFontScale] = useState<0.9 | 1 | 1.15 | 1.3>(() => {
    if (typeof window === "undefined") return 1;
    const saved = Number(window.localStorage.getItem("noteEditor:fontScale"));
    return ([0.9, 1, 1.15, 1.3] as const).includes(saved as any)
      ? (saved as 0.9 | 1 | 1.15 | 1.3)
      : 1;
  });
  const [highContrast, setHighContrast] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("noteEditor:highContrast") === "1";
  });
  const [dyslexiaFont, setDyslexiaFont] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("noteEditor:dyslexiaFont") === "1";
  });
  // #27 Spell Check, first pass: the browser's own native spellcheck
  // (red squiggly underlines) rather than anything server-side --
  // Tiptap/ProseMirror don't touch spelling at all, this is purely the
  // `spellcheck` attribute on the underlying contentEditable element.
  // Same per-browser preference reasoning as the three toggles above;
  // defaults ON (absent localStorage key reads as enabled) since that
  // matches what a plain contentEditable does with no attribute set.
  const [spellcheckEnabled, setSpellcheckEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = window.localStorage.getItem("noteEditor:spellcheck");
    return saved === null ? true : saved === "1";
  });

  useEffect(() => {
    window.localStorage.setItem("noteEditor:fontScale", String(fontScale));
  }, [fontScale]);
  useEffect(() => {
    window.localStorage.setItem("noteEditor:highContrast", highContrast ? "1" : "0");
  }, [highContrast]);
  useEffect(() => {
    window.localStorage.setItem("noteEditor:dyslexiaFont", dyslexiaFont ? "1" : "0");
  }, [dyslexiaFont]);
  useEffect(() => {
    window.localStorage.setItem("noteEditor:spellcheck", spellcheckEnabled ? "1" : "0");
  }, [spellcheckEnabled]);
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
  const [linkPreviewOpen, setLinkPreviewOpen] = useState(false);
  const [linkPreviewUrl, setLinkPreviewUrl] = useState("");
  const [isSavingLinkPreview, setIsSavingLinkPreview] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  // Deliberately no dependency array -- this is meant to rerun and
  // reassign on every render, not just on mount. slashCommandBridge is a
  // plain module-level object (see lib/tiptap/slash-command.ts) shared
  // with the ProseMirror plugin, which can't reach React state/props
  // directly; these closures are how it calls back into this component.
  // Giving this `[]` would freeze the closures to their first-render
  // values (e.g. state setters would still work since setState is
  // stable, but any render-scoped value these ever start capturing
  // would go stale). The three setters below cost nothing to reassign,
  // so rerunning every render is cheap insurance against that class of
  // bug rather than something to "optimize" away.
  useEffect(() => {
    slashCommandBridge.openResourcePicker = () => setPickerOpen(true);
    slashCommandBridge.openDiagramPanel = () => setDiagramPanelOpen(true);
    slashCommandBridge.openLinkPreviewPanel = () => setLinkPreviewOpen(true);
  });
  const [diagramTitle, setDiagramTitle] = useState("");
  const [diagramCode, setDiagramCode] = useState(DEFAULT_MERMAID);
  const [isSavingDiagram, setIsSavingDiagram] = useState(false);
  const [internalMobileTab, setInternalMobileTab] = useState<MobileTab>("write");
  const mobileTab = controlledMobileTab ?? internalMobileTab;
  const setMobileTab = onMobileTabChange ?? setInternalMobileTab;
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const dragDepthRef = useRef(0);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const assessmentPickerRef = useRef<HTMLDivElement | null>(null);
  const topicPickerRef = useRef<HTMLDivElement | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);
  const symbolPickerRef = useRef<HTMLDivElement | null>(null);
  const colorPickerRef = useRef<HTMLDivElement | null>(null);
  const editorShellRef = useRef<HTMLDivElement | null>(null);
  const emojiPopupRef = useRef<HTMLDivElement | null>(null);
  const diagramSectionRef = useRef<HTMLDivElement | null>(null);
  const noteContainerRef = useRef<HTMLDivElement | null>(null);

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

  // Mutex for the "no note exists yet" window. handleSave (first save)
  // and ensureNoteId (drag-drop resource insert / diagram generation) can
  // both fire while currentNoteId is still null -- e.g. a teacher drags a
  // file in at the exact moment they click "Save draft". Without this,
  // both paths independently call saveTopicNote and, since notes are
  // append-only, that creates two brand-new rows instead of one. Whoever
  // gets here first performs the actual insert and stores the in-flight
  // promise here; whoever arrives second just awaits it and reuses the
  // resulting id instead of racing a duplicate insert.
  const pendingNoteCreationRef = useRef<Promise<string> | null>(null);

  async function createFirstNoteIfNeeded(
    content: string,
    status: "draft" | "published"
  ): Promise<{ id: string; createdHere: boolean }> {
    if (currentNoteId) return { id: currentNoteId, createdHere: false };
    if (pendingNoteCreationRef.current) {
      const id = await pendingNoteCreationRef.current;
      return { id, createdHere: false };
    }
    const creation = (async () => {
      const note = await saveTopicNote(topicId, content, status);
      if (!note?.id) throw new Error("Could not create the note.");
      return note.id;
    })();
    pendingNoteCreationRef.current = creation;
    try {
      const id = await creation;
      setCurrentNoteId(id);
      return { id, createdHere: true };
    } finally {
      // Only clear once this call's own creation settles -- concurrent
      // callers already captured the same promise reference above and
      // will resolve from it regardless of when this ref is cleared.
      pendingNoteCreationRef.current = null;
    }
  }

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

  // Kept in a ref rather than a `useEffect` dependency -- the callback
  // itself changes identity on nearly every parent render (it's an inline
  // closure over `setSidebarResources`), and depending on it directly
  // would refire this effect on every unrelated re-render. Only an actual
  // `localResources` change should notify the parent.
  const onResourcesChangeRef = useRef(onResourcesChange);
  useEffect(() => {
    onResourcesChangeRef.current = onResourcesChange;
  });
  useEffect(() => {
    onResourcesChangeRef.current?.(localResources);
  }, [localResources]);

  // handlePickResource/uploadDroppedFiles are `function` declarations
  // further down this component and hoisted within scope, so referencing
  // them here (before their textual definition) is safe.
  // No dependency array -- handlePickResource/uploadDroppedFiles are
  // plain function declarations recreated every render (they close over
  // render-scoped state like `currentNoteId`/`editor`), so memoizing this
  // against them would just recompute on every render anyway. Cheap
  // either way; this avoids the exhaustive-deps churn of wrapping both
  // in their own useCallback just to satisfy the lint rule.
  useImperativeHandle(ref, () => ({
    insertResource: handlePickResource,
    uploadFiles: uploadDroppedFiles,
  }));

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
      AssessmentChip,
      TopicLinkChip,
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
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Note content",
        spellcheck: "true",
      },
      handlePaste(_view, event) {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) =>
          f.type.startsWith("image/")
        );
        if (files.length > 0) {
          event.preventDefault();
          void uploadDroppedFiles(files);
          return true;
        }

        // #22 Link Preview "on paste": only when the *entire* clipboard
        // payload is one bare URL and nothing else (trimmed exact
        // match, not just "contains a URL somewhere") -- pasting a URL
        // as part of a sentence ("see https://example.com for more")
        // should still paste as plain text, not get swapped for a
        // resource card the teacher didn't ask for.
        const pastedText = event.clipboardData?.getData("text/plain")?.trim() ?? "";
        if (pastedText && isBareHttpUrl(pastedText)) {
          event.preventDefault();
          void handleAddLinkPreview(pastedText);
          return true;
        }

        return false; // let normal paste handling run
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

  // editorProps.attributes only gets applied once, at creation -- unlike
  // fontScale/highContrast/dyslexiaFont (plain CSS classes on a wrapper,
  // which just re-render), the `spellcheck` attribute lives directly on
  // ProseMirror's own contentEditable DOM node, so toggling it after
  // mount needs an explicit setOptions call to actually reach that node.
  // Spreading the existing editorProps first is required, not optional:
  // setOptions *replaces* editorProps wholesale, so omitting that spread
  // would silently drop handlePaste (image upload / link-preview paste
  // handling) the moment this toggle changes.
  useEffect(() => {
    if (!editor) return;
    editor.setOptions({
      editorProps: {
        ...editor.options.editorProps,
        attributes: {
          ...(editor.options.editorProps.attributes as Record<string, string> | undefined),
          spellcheck: spellcheckEnabled ? "true" : "false",
        },
      },
    });
  }, [editor, spellcheckEnabled]);

  // In-note find/replace -- extracted into useNoteSearch
  // (lib/hooks/useNoteSearch.ts). Placed after `editor` exists since the
  // hook needs the live instance to walk the doc for matches.
  const {
    searchOpen,
    setSearchOpen,
    searchTerm,
    setSearchTerm,
    replaceTerm,
    setReplaceTerm,
    matchCase,
    setMatchCase,
    searchInputRef,
    searchMatches,
    selectSearchMatch,
    replaceSearchMatch,
    replaceAllSearchMatches,
  } = useNoteSearch(editor);

  function enterFocusMode() {
    setSearchOpen(false);
    setPickerOpen(false);
    setEmojiPickerOpen(false);
    setSymbolPickerOpen(false);
    setColorPickerOpen(false);
    setDiagramPanelOpen(false);
    setVideoEmbedOpen(false);
    setLinkPreviewOpen(false);
    setFocusMode(true);
    requestAnimationFrame(() => editor?.commands.focus());
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await editorShellRef.current?.requestFullscreen();
    } catch {
      emitToast("Fullscreen is not available in this browser.", "error");
    }
  }

  useEffect(() => {
    const update = () => setIsFullscreen(document.fullscreenElement === editorShellRef.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

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

  useEffect(() => {
    if (!editor) return;
    editor.storage.assessmentChip.assessments = assessments;
  }, [editor, assessments]);

  useEffect(() => {
    if (!editor) return;
    editor.storage.topicLinkChip.topics = topics;
  }, [editor, topics]);

  const getMarkdown = () => (editor as any)?.storage.markdown.getMarkdown() as string;

  // The mobile Write/Preview/Resources tab bar only renders below `md`
  // (the tab bar itself is `md:hidden`), so this never fires from user
  // interaction on desktop — mobileTab stays "write" there and editing is
  // unaffected. Toggling real editability (not just a cosmetic class) is
  // what makes "Preview" an actual read view: same TipTap content/node-views
  // (tables, images, Mermaid, resource chips) render identically, just
  // without a cursor or toolbar. "Resources" doesn't touch editability at
  // all -- it just hides this component's own content area (see the
  // `topic-prose` div's className below) so the sidebar NoteWorkspace
  // renders alongside this component can take its place on a small screen.
  useEffect(() => {
    editor?.setEditable(!forcePreview && mobileTab !== "preview");
  }, [editor, mobileTab, forcePreview]);

  function computeNoteStats(ed: NonNullable<typeof editor>) {
    let headings = 0;
    let tables = 0;
    let images = 0;
    let resources = 0;
    let linkedAssessments = 0;
    let linkedTopics = 0;
    ed.state.doc.descendants((node) => {
      if (node.type.name === "heading") headings++;
      else if (node.type.name === "table") tables++;
      else if (node.type.name === "resourceChip") {
        resources++;
        const resource = localResources.find((r) => r.id === node.attrs.id);
        if (resource?.resource_type === "image") images++;
      } else if (node.type.name === "assessmentChip") {
        linkedAssessments++;
      } else if (node.type.name === "topicLinkChip") {
        linkedTopics++;
      }
      return true;
    });
    const words: number = ed.storage.characterCount.words();
    const characters: number = ed.storage.characterCount.characters();
    // 200 wpm is the commonly-cited average adult silent-reading speed --
    // good enough for a rough "how long will this take a student to
    // read" estimate, not meant to be precise.
    const readingMinutes = Math.max(1, Math.round(words / 200));
    return {
      words,
      characters,
      readingMinutes,
      headings,
      tables,
      images,
      resources,
      linkedAssessments,
      linkedTopics,
    };
  }

  // Recomputed only when the doc actually changes (editor.state.doc gets
  // a new reference each transaction) rather than on every render -- this
  // walks the entire doc via descendants(), which previously ran inline
  // in JSX on every keystroke regardless of whether anything relevant to
  // the stats had changed.
  const noteStats = useMemo(
    () => (editor ? computeNoteStats(editor) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, editor?.state.doc, localResources]
  );

  // Dirty-state, autosave, offline detection, and unsaved-draft recovery
  // -- extracted into useNoteAutosave (lib/hooks/useNoteAutosave.ts).
  // setIsDirty/setLastSavedContent/setLastSavedAt are still called
  // directly from this component (handleSave, ensureNoteId,
  // handleSaveDiagram, uploadDroppedFiles) since marking a real save as
  // clean is this component's job, not the hook's -- see the hook's own
  // top comment for why the split lands there.
  const {
    isDirty,
    setIsDirty,
    lastSavedContent,
    setLastSavedContent,
    lastSavedAt,
    setLastSavedAt,
    autosaveStatus,
    lastAutosaveAt,
    isOnline,
    draftBanner,
    restoreDraft,
    discardDraft,
  } = useNoteAutosave(editor, topicId, initialContent);

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
        let noteId: string;
        if (isFirstSave) {
          // Route the "note doesn't exist yet" case through the shared
          // mutex -- a concurrent ensureNoteId() call (drag-drop insert,
          // diagram generation) may already be creating it.
          const result = await createFirstNoteIfNeeded(content, status);
          noteId = result.id;
          if (!result.createdHere) {
            // Someone else's concurrent call performed the actual insert
            // (e.g. a dropped file's ensureNoteId(), which always saves as
            // "draft"). If this click specifically asked for something
            // else -- a real "Publish" -- apply it as a normal follow-up
            // revision now that a note exists, so the requested status
            // isn't silently lost. No race here: currentNoteId is set by
            // this point, so this goes through the ordinary append-only
            // path, not another first-save race.
            if (status === "published") {
              const note = await saveTopicNote(topicId, content, status);
              if (note?.id) noteId = note.id;
            }
          }
        } else {
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
          const note = await saveTopicNote(topicId, content, status);
          noteId = note?.id ?? currentNoteId!;
        }
        setCurrentNoteId(noteId);
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
    const { id, createdHere } = await createFirstNoteIfNeeded(getMarkdown(), "draft");
    if (createdHere) {
      setLastSavedContent(getMarkdown());
      setLastSavedAt(new Date());
      setIsDirty(false);
      router.refresh();
    }
    return id;
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

  // Shared by both the "Add link" panel and the paste-a-bare-URL
  // shortcut below -- fetches title/description/image server-side
  // (fetchLinkMetadata is SSRF-guarded, see lib/linkPreview.ts) and
  // drops the result in as a resource chip the same way every other
  // insert path here does.
  async function handleAddLinkPreview(url: string) {
    setIsSavingLinkPreview(true);
    try {
      const savedNoteId = await ensureNoteId();
      const resource = await createLinkResource(topicId, savedNoteId, url);
      setLocalResources((previous) => [...previous, resource]);
      insertResourceMarker(resource);
      setLinkPreviewUrl("");
      setLinkPreviewOpen(false);
      emitToast("Link preview added.");
    } catch (err: unknown) {
      emitToast(
        err instanceof Error ? err.message : "Unable to fetch a preview for that link.",
        "error"
      );
    } finally {
      setIsSavingLinkPreview(false);
    }
  }

  function handleInsertLinkPreview() {
    if (!linkPreviewUrl.trim()) {
      emitToast("Paste a link first.", "error");
      return;
    }
    void handleAddLinkPreview(linkPreviewUrl.trim());
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
    if (!assessmentPickerOpen) {
      setAssessmentFilter("");
      return;
    }
    function handleClickOutside(e: MouseEvent) {
      if (assessmentPickerRef.current && !assessmentPickerRef.current.contains(e.target as Node)) {
        setAssessmentPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [assessmentPickerOpen]);

  useEffect(() => {
    if (!topicPickerOpen) {
      setTopicFilter("");
      return;
    }
    function handleClickOutside(e: MouseEvent) {
      if (topicPickerRef.current && !topicPickerRef.current.contains(e.target as Node)) {
        setTopicPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [topicPickerOpen]);

  useEffect(() => {
    if (!emojiPickerOpen) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      // The cursor-anchored popup (emojiPopupRef) renders outside the
      // toolbar wrapper's DOM subtree via `position: fixed`, so a click
      // inside it wouldn't register as "inside emojiPickerRef" -- check
      // both, or picking an emoji from the floating popup would
      // immediately close itself before onSelectAction's own close ever ran.
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
    if (!a11yMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (a11yMenuRef.current && !a11yMenuRef.current.contains(e.target as Node)) {
        setA11yMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [a11yMenuOpen]);

  function promptForLink() {
    if (!editor) return;
    const url = window.prompt("Link URL (include https://)");
    if (url) editor.chain().focus().setLink({ href: url }).run();
  }

  function openSlashCommands() {
    if (!editor) return;
    editor.commands.focus();
    requestAnimationFrame(() => {
      const { from, to } = editor.state.selection;
      editor.view.dispatch(editor.state.tr.insertText("/", from, to));
    });
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
        openSlashCommands();
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

  function insertAssessmentMarker(assessment: LinkableAssessment) {
    editor
      ?.chain()
      .focus()
      .insertContent({ type: "assessmentChip", attrs: { id: assessment.id } })
      .run();
  }

  function handlePickAssessment(assessment: LinkableAssessment) {
    insertAssessmentMarker(assessment);
    setAssessmentPickerOpen(false);
  }

  function insertTopicMarker(topic: LinkableTopic) {
    editor
      ?.chain()
      .focus()
      .insertContent({ type: "topicLinkChip", attrs: { id: topic.id } })
      .run();
  }

  function handlePickTopic(topic: LinkableTopic) {
    insertTopicMarker(topic);
    setTopicPickerOpen(false);
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
      ref={editorShellRef}
      suppressHydrationWarning
      className={`${focusMode ? "fixed inset-0 z-50 overflow-y-auto bg-paper px-4 py-6 sm:px-8" : ""} [&:fullscreen]:h-screen [&:fullscreen]:overflow-y-auto [&:fullscreen]:bg-paper [&:fullscreen]:p-6`}
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
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rule bg-white p-3 shadow-sm">
              <p className="flex flex-wrap items-center gap-2 text-sm text-ink">
                <span className="text-xs font-medium uppercase tracking-wide text-ink-soft">
                  Currently
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${initialStatus === "published" ? "bg-leaf/15 text-leaf" : initialStatus === "draft" ? "bg-marigold/20 text-ink" : "bg-paper text-ink-soft"}`}
                >
                  {initialStatus}
                </span>
                {isDirty && (
                  <span className="ml-2 normal-case text-marigold-text">Unsaved changes</span>
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

                <div className="relative" ref={assessmentPickerRef}>
                  <button
                    type="button"
                    onClick={() => setAssessmentPickerOpen((open) => !open)}
                    disabled={isPending || assessments.length === 0}
                    className="rounded-lg border border-rule px-3 py-1.5 text-sm text-ink hover:bg-paper disabled:opacity-60"
                    title={
                      assessments.length === 0
                        ? "No assessments for this subject yet"
                        : "Link an existing assessment — opens its own page, doesn't embed its questions"
                    }
                  >
                    Link assessment
                  </button>
                  {assessmentPickerOpen && assessments.length > 0 && (
                    <div className="absolute right-0 z-10 mt-1 w-64 rounded-lg border border-rule bg-white py-1 shadow-lg">
                      {/* With 20-30+ assessments once a subject/class has
                          a term's worth, scrolling to find one by eye
                          stopped being workable -- filter narrows the
                          list as you type instead of just scrolling
                          faster. */}
                      {assessments.length > 5 && (
                        <div className="px-2 pb-1">
                          <input
                            autoFocus
                            type="text"
                            value={assessmentFilter}
                            onChange={(e) => setAssessmentFilter(e.target.value)}
                            placeholder="Filter by title…"
                            className="w-full rounded-md border border-rule px-2 py-1 text-sm outline-none focus-visible:border-marigold"
                          />
                        </div>
                      )}
                      <div className="max-h-64 overflow-y-auto">
                        {assessments
                          .filter((a) =>
                            a.title.toLowerCase().includes(assessmentFilter.trim().toLowerCase())
                          )
                          .map((assessment) => (
                            <button
                              key={assessment.id}
                              type="button"
                              onClick={() => handlePickAssessment(assessment)}
                              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-paper"
                            >
                              <span className="min-w-0">
                                <span className="block truncate">{assessment.title}</span>
                                {(assessment.classLabel || assessment.academic_year) && (
                                  <span className="block truncate text-xs text-ink-soft">
                                    {[
                                      assessment.classLabel,
                                      assessment.academic_year,
                                      `Term ${assessment.term}`,
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </span>
                                )}
                              </span>
                              <span className="shrink-0 text-xs uppercase tracking-wide text-ink-soft">
                                {assessment.assessment_type.replace(/_/g, " ")}
                              </span>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative" ref={topicPickerRef}>
                  <button
                    type="button"
                    onClick={() => setTopicPickerOpen((open) => !open)}
                    disabled={isPending || topics.length === 0}
                    className="rounded-lg border border-rule px-3 py-1.5 text-sm text-ink hover:bg-paper disabled:opacity-60"
                    title={
                      topics.length === 0
                        ? "No other topics for this subject yet"
                        : "Link another topic — opens its own note, doesn't embed its content"
                    }
                  >
                    Link topic
                  </button>
                  {topicPickerOpen && topics.length > 0 && (
                    <div className="absolute right-0 z-10 mt-1 w-64 rounded-lg border border-rule bg-white py-1 shadow-lg">
                      {topics.length > 5 && (
                        <div className="px-2 pb-1">
                          <input
                            autoFocus
                            type="text"
                            value={topicFilter}
                            onChange={(e) => setTopicFilter(e.target.value)}
                            placeholder="Filter by title…"
                            className="w-full rounded-md border border-rule px-2 py-1 text-sm outline-none focus-visible:border-marigold"
                          />
                        </div>
                      )}
                      <div className="max-h-64 overflow-y-auto">
                        {topics
                          .filter((t) =>
                            t.title.toLowerCase().includes(topicFilter.trim().toLowerCase())
                          )
                          .map((topic) => (
                            <button
                              key={topic.id}
                              type="button"
                              onClick={() => handlePickTopic(topic)}
                              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-paper"
                            >
                              <span className="min-w-0">
                                <span className="block truncate">{topic.title}</span>
                                <span className="block truncate text-xs text-ink-soft">
                                  Term {topic.term} ·{" "}
                                  {topic.week_end_number > topic.week_number
                                    ? `Weeks ${topic.week_number}–${topic.week_end_number}`
                                    : `Week ${topic.week_number}`}
                                </span>
                              </span>
                            </button>
                          ))}
                      </div>
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
                  type="button"
                  onClick={toggleFullscreen}
                  className="rounded-lg border border-marigold bg-marigold/15 px-3 py-1.5 text-sm font-medium text-ink hover:bg-marigold/25"
                >
                  {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                </button>
                <button
                  type="button"
                  onClick={() => setLinkPreviewOpen((open) => !open)}
                  disabled={isPending}
                  className="rounded-lg border border-rule px-3 py-1.5 text-sm text-ink hover:bg-paper disabled:opacity-60"
                >
                  Add link
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

          {!focusMode && linkPreviewOpen && (
            <section className="mb-4 rounded-xl border border-rule bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold text-ink">Add link</h3>
                <button
                  type="button"
                  onClick={() => setLinkPreviewOpen(false)}
                  className="text-xs text-ink-soft hover:underline"
                >
                  Close
                </button>
              </div>
              <p className="mb-3 text-sm text-ink-soft">
                Paste any link -- title, thumbnail, and description are fetched automatically.
              </p>
              <input
                value={linkPreviewUrl}
                onChange={(e) => setLinkPreviewUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isSavingLinkPreview) handleInsertLinkPreview();
                }}
                placeholder="https://example.com/article"
                type="url"
                className="w-full rounded-lg border border-rule p-2 text-sm outline-none focus-visible:border-marigold"
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleInsertLinkPreview}
                  disabled={isSavingLinkPreview}
                  className="rounded-lg bg-marigold px-3 py-1.5 text-sm font-medium text-ink hover:bg-marigold-dark disabled:opacity-60"
                >
                  {isSavingLinkPreview ? "Fetching…" : "Add link"}
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

          {!focusMode && !forcePreview && (
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
              <button
                type="button"
                onClick={() => setMobileTab("resources")}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${mobileTab === "resources" ? "bg-white text-ink shadow-sm" : "text-ink-soft"}`}
              >
                Resources
              </button>
            </div>
          )}

          {!focusMode && !forcePreview && (
            <NoteToolbar
              editor={editor}
              mobileTab={mobileTab}
              searchOpen={searchOpen}
              onOpenSearch={() => setSearchOpen(true)}
              onEnterFocusMode={enterFocusMode}
              colorPickerOpen={colorPickerOpen}
              setColorPickerOpen={setColorPickerOpen}
              colorPickerRef={colorPickerRef}
              emojiPickerOpen={emojiPickerOpen}
              setEmojiPickerOpen={setEmojiPickerOpen}
              emojiPickerPos={emojiPickerPos}
              setEmojiPickerPos={setEmojiPickerPos}
              emojiPickerRef={emojiPickerRef}
              onInsertEmoji={insertEmoji}
              symbolPickerOpen={symbolPickerOpen}
              setSymbolPickerOpen={setSymbolPickerOpen}
              symbolPickerRef={symbolPickerRef}
              onInsertSymbol={insertSymbol}
              onOpenSlashCommands={openSlashCommands}
              onInsertMath={insertMath}
              onInsertTable={insertTable}
              a11yMenuOpen={a11yMenuOpen}
              setA11yMenuOpen={setA11yMenuOpen}
              a11yMenuRef={a11yMenuRef}
              fontScale={fontScale}
              setFontScale={setFontScale}
              highContrast={highContrast}
              setHighContrast={setHighContrast}
              dyslexiaFont={dyslexiaFont}
              setDyslexiaFont={setDyslexiaFont}
              spellcheckEnabled={spellcheckEnabled}
              setSpellcheckEnabled={setSpellcheckEnabled}
            />
          )}

          {emojiPickerOpen && emojiPickerPos && (
            <div
              ref={emojiPopupRef}
              style={{ position: "fixed", left: emojiPickerPos.left, top: emojiPickerPos.top }}
              className="z-20"
            >
              <EmojiPicker onSelectAction={insertEmoji} />
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
              <div
                role="toolbar"
                aria-label="Table formatting"
                className="flex flex-wrap items-center gap-0.5 rounded-xl border border-rule/70 bg-white p-1.5 shadow-lg shadow-ink/10 ring-1 ring-ink/5"
              >
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
              <div
                role="toolbar"
                aria-label="Text formatting"
                className="flex items-center gap-1 rounded-lg border border-rule bg-white px-1 py-1 shadow-lg"
              >
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  className="rounded px-2 py-1 text-sm font-semibold hover:bg-paper"
                  title="Bold (Ctrl/Cmd+B)"
                  aria-label="Bold"
                  aria-pressed={editor.isActive("bold")}
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  className="rounded px-2 py-1 text-sm italic hover:bg-paper"
                  title="Italic (Ctrl/Cmd+I)"
                  aria-label="Italic"
                  aria-pressed={editor.isActive("italic")}
                >
                  I
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                  className="rounded px-2 py-1 text-sm underline hover:bg-paper"
                  title="Underline (Ctrl/Cmd+U)"
                  aria-label="Underline"
                  aria-pressed={editor.isActive("underline")}
                >
                  U
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleHighlight().run()}
                  className={`rounded px-2 py-1 text-sm hover:bg-paper ${editor.isActive("highlight") ? "bg-paper" : ""}`}
                  title="Highlight"
                  aria-label="Highlight"
                >
                  ▧
                </button>
                <button
                  type="button"
                  onClick={promptForLink}
                  className="rounded px-2 py-1 text-sm hover:bg-paper"
                  title="Link (Ctrl/Cmd+K)"
                  aria-label="Link (Ctrl/Cmd+K)"
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
            style={{ "--note-font-size": `${fontScale}rem` } as React.CSSProperties}
            className={`topic-prose relative min-h-[24rem] bg-white p-4 ${
              mobileTab === "resources" ? "hidden md:block" : ""
            } ${highContrast ? "a11y-high-contrast" : ""} ${dyslexiaFont ? "a11y-dyslexia-font" : ""} ${
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
            <div
              className={`mt-2 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft ${
                mobileTab === "resources" ? "hidden md:flex" : "flex"
              }`}
            >
              {noteStats && (
                <>
                  <span>
                    {noteStats.words} word{noteStats.words === 1 ? "" : "s"}
                  </span>
                  <span>
                    {noteStats.characters} character{noteStats.characters === 1 ? "" : "s"}
                  </span>
                  <span>~{noteStats.readingMinutes} min read</span>
                  {noteStats.headings > 0 && (
                    <span>
                      {noteStats.headings} heading{noteStats.headings === 1 ? "" : "s"}
                    </span>
                  )}
                  {noteStats.tables > 0 && (
                    <span>
                      {noteStats.tables} table{noteStats.tables === 1 ? "" : "s"}
                    </span>
                  )}
                  {noteStats.images > 0 && (
                    <span>
                      {noteStats.images} image{noteStats.images === 1 ? "" : "s"}
                    </span>
                  )}
                  {noteStats.resources > 0 && (
                    <span>
                      {noteStats.resources} resource{noteStats.resources === 1 ? "" : "s"}
                    </span>
                  )}
                  {noteStats.linkedAssessments > 0 && (
                    <span>
                      {noteStats.linkedAssessments} linked assessment
                      {noteStats.linkedAssessments === 1 ? "" : "s"}
                    </span>
                  )}
                  {noteStats.linkedTopics > 0 && (
                    <span>
                      {noteStats.linkedTopics} linked topic{noteStats.linkedTopics === 1 ? "" : "s"}
                    </span>
                  )}
                </>
              )}
            </div>
          )}

          <p
            className={`mt-3 text-xs text-ink-soft ${
              mobileTab === "resources" ? "hidden md:block" : ""
            }`}
          >
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
});
