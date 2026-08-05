/**
 * AssessmentChip — a TipTap inline atom node standing in for
 * `[[assessment:UUID]]` markers, the assessment-side counterpart to
 * ResourceChip's `[[resource:UUID]]` (resource-node.tsx). Built for #16
 * on the markdown-editor to-do, per the product decision recorded there:
 * assessments stay a fully separate system (CreateAssessmentForm,
 * GradeEntryForm) — this is a *link*, not an embed. No question-type
 * authoring (Multiple Choice/True-False/etc.) happens here at all; the
 * chip is a read-only reference card that opens the existing
 * /dashboard/teacher/grades/[assessmentId] page.
 *
 * That's the one deliberate divergence from ResourceChip's shape: no
 * "Edit" action in the popover (there's nothing here to edit — the title,
 * type, term, and max score all live on the assessments row itself, only
 * viewable/editable on its own page), and no upload/replace-file flow.
 * Otherwise this follows ResourceChip's structure closely: same
 * drag-to-reorder handle (native PM node dragging, `dragAwareStopEvent`),
 * same "resolve id against a live list passed via editor storage" trick
 * so a title change or deletion on the assessments page is reflected
 * without re-serializing the doc, same markdown round-trip shape.
 */
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { clampPopoverToEditor } from "./popover-position";
import type { Assessment } from "@/types/database";
import { dragAwareStopEvent } from "./drag-utils";

// Assessments are now linkable by subject *and* class (see page.tsx),
// not scoped to "assessments I personally created" -- with multiple
// classes at the same education_level/level_number potentially each
// having their own assessment for this subject, the class each one
// belongs to needs to be visible wherever an assessment is picked or
// shown, or two same-named assessments for different class arms become
// indistinguishable. `classLabel` is resolved from the `classes` join at
// the query site (page.tsx) into a plain string, rather than every
// consumer here re-deriving it from Supabase's array-or-object join
// shape.
export type LinkableAssessment = Assessment & { classLabel: string };

export const ASSESSMENT_TYPE_ICON: Record<Assessment["assessment_type"], string> = {
  first_ca: "📋",
  second_ca: "📋",
  exam: "📝",
  test: "❓",
  assignment: "📚",
  project: "🛠️",
  practical: "🧪",
  other: "📊",
};

const DEFAULT_ASSESSMENT_ICON = "📊";

// `[[assessment:UUID]]` — deliberately the same bracket-marker shape as
// `[[resource:UUID]]`, just a different keyword, so it round-trips
// through the exact same kind of plain-text storage saveTopicNote
// already writes, with no new grammar concept for a reader of the raw
// markdown to learn.
const ASSESSMENT_MARKER_RE = /\[\[assessment:([0-9a-fA-F-]{36})\]\]/;

export interface AssessmentChipStorage {
  assessments: LinkableAssessment[];
  onRemove?: (id: string) => void;
}

declare module "@tiptap/core" {
  interface Storage {
    assessmentChip: AssessmentChipStorage;
  }
}

function AssessmentChipView({
  node,
  editor,
  deleteNode,
}: {
  node: any;
  editor: any;
  deleteNode: () => void;
}) {
  const id: string = node.attrs.id;
  const storage: AssessmentChipStorage = editor.storage.assessmentChip ?? { assessments: [] };
  const assessment = storage.assessments.find((a) => a.id === id) ?? null;

  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [dragArmed, setDragArmed] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLSpanElement>(null);

  // Same containment/clamping trick every other in-doc popover in this
  // app uses (math nodes, slash menu, emoji picker, resource chips) —
  // keeps the card from overflowing the editor's own scroll container
  // rather than the browser viewport.
  useLayoutEffect(() => {
    if (!previewOpen || !popoverRef.current) return;
    clampPopoverToEditor(popoverRef.current, editor?.view?.dom ?? null);
  }, [previewOpen, editor]);

  function closePopover() {
    setPreviewOpen(false);
    setConfirmingRemove(false);
  }

  return (
    <NodeViewWrapper
      as="span"
      ref={wrapperRef}
      className="relative inline-flex items-center align-middle"
      contentEditable={false}
      draggable={dragArmed}
      onDragEnd={() => setDragArmed(false)}
    >
      <span
        onMouseDown={() => setDragArmed(true)}
        onMouseUp={() => setDragArmed(false)}
        contentEditable={false}
        title="Drag to reorder (or select it and press Alt+Left/Right)"
        aria-label="Drag to reorder this assessment link, or select it and press Alt+Left or Alt+Right"
        role="button"
        data-drag-handle
        className="mr-0.5 inline-flex cursor-grab select-none items-center text-xs text-ink-soft/60 hover:text-ink-soft active:cursor-grabbing"
      >
        ⠿
      </span>
      <button
        type="button"
        onClick={() => {
          setPreviewOpen((open) => !open);
          setConfirmingRemove(false);
        }}
        className={`mx-0.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
          assessment
            ? "border-leaf/40 bg-leaf-soft text-leaf hover:border-leaf"
            : "border-clay/40 bg-clay/10 text-clay"
        }`}
        contentEditable={false}
        data-assessment-id={id}
        title={
          assessment ? "Click to view or remove this link" : "This assessment no longer exists"
        }
      >
        <span aria-hidden>
          {assessment
            ? (ASSESSMENT_TYPE_ICON[assessment.assessment_type] ?? DEFAULT_ASSESSMENT_ICON)
            : "⚠️"}
        </span>
        <span className="max-w-[9rem] truncate">
          {assessment ? assessment.title : "Missing assessment"}
        </span>
      </button>

      {previewOpen && (
        <span
          ref={popoverRef}
          contentEditable={false}
          className="absolute left-0 top-full z-20 mt-1 w-72 max-w-[90vw] rounded-lg border border-rule bg-white p-4 shadow-xl"
          onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
          onKeyDown={(e: React.KeyboardEvent) => e.stopPropagation()}
          onKeyUp={(e: React.KeyboardEvent) => e.stopPropagation()}
        >
          {assessment ? (
            <span className="block">
              <span className="mb-1 flex items-center gap-1.5 text-sm font-medium text-ink">
                <span aria-hidden>
                  {ASSESSMENT_TYPE_ICON[assessment.assessment_type] ?? DEFAULT_ASSESSMENT_ICON}
                </span>
                {assessment.title}
              </span>
              <span className="block text-xs capitalize text-ink-soft">
                {assessment.assessment_type.replace(/_/g, " ")} · Term {assessment.term} · out of{" "}
                {assessment.max_score}
                {assessment.weight_percent != null
                  ? ` · ${assessment.weight_percent}% of grade`
                  : ""}
              </span>
              {assessment.classLabel && (
                <span className="mt-0.5 block text-xs text-ink-soft">{assessment.classLabel}</span>
              )}

              {confirmingRemove ? (
                <span className="mt-3 flex items-center justify-between gap-2 rounded-md border border-clay/40 bg-clay/10 p-2">
                  <span className="text-xs text-clay">Remove this link from the note?</span>
                  <span className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setConfirmingRemove(false)}
                      className="text-xs text-ink-soft hover:underline"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteNode()}
                      className="rounded bg-clay px-2 py-1 text-xs font-medium text-white hover:bg-clay/90"
                    >
                      Remove
                    </button>
                  </span>
                </span>
              ) : (
                <span className="mt-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={closePopover}
                    className="text-xs text-ink-soft hover:underline"
                  >
                    Close
                  </button>
                  <span className="flex items-center gap-3">
                    <Link
                      href={`/dashboard/teacher/grades/${assessment.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-leaf hover:underline"
                    >
                      Open assessment ↗
                    </Link>
                    <button
                      type="button"
                      onClick={() => setConfirmingRemove(true)}
                      className="text-xs font-medium text-clay hover:underline"
                    >
                      Remove from note
                    </button>
                  </span>
                </span>
              )}
            </span>
          ) : (
            <span className="block">
              <span className="block text-sm text-clay">
                This assessment was deleted elsewhere. Remove this link, or link a different one
                from &quot;Link assessment&quot;.
              </span>
              <span className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => deleteNode()}
                  className="rounded bg-clay px-2 py-1 text-xs font-medium text-white hover:bg-clay/90"
                >
                  Remove
                </button>
              </span>
            </span>
          )}
        </span>
      )}
    </NodeViewWrapper>
  );
}

export const AssessmentChip = Node.create({
  name: "assessmentChip",
  group: "inline",
  inline: true,
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      id: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-assessment-id]",
        getAttrs: (el) => ({
          id: (el as HTMLElement).getAttribute("data-assessment-id"),
        }),
      },
    ];
  },

  renderHTML({ node }) {
    return ["span", mergeAttributes({ "data-assessment-id": node.attrs.id })];
  },

  addNodeView() {
    // Same stopEvent split as ResourceChip (see the long comment above
    // its addNodeView): a blanket `() => true` would silently swallow
    // ProseMirror's own native node-dragging events, so anything not
    // drag-related is handed to React, and drag/drop-family events are
    // left for PM to actually perform the move.
    return ReactNodeViewRenderer(AssessmentChipView, {
      stopEvent: dragAwareStopEvent,
    });
  },

  addStorage() {
    return { assessments: [] as LinkableAssessment[] } as AssessmentChipStorage;
  },
});

// Registered the same way resourceMarkdownPlugin is — called once when
// building the editor's markdown-it instance (see NoteEditor.tsx), not
// passed into Markdown.configure(), since tiptap-markdown has no global
// markdownIt hook.
export function assessmentMarkdownPlugin(md: any) {
  md.inline.ruler.before("link", "assessment_chip", (state: any, silent: boolean) => {
    const match = ASSESSMENT_MARKER_RE.exec(state.src.slice(state.pos));
    if (!match || match.index !== 0) return false;
    if (!silent) {
      const token = state.push("assessment_chip", "", 0);
      token.attrs = [["id", match[1]]];
    }
    state.pos += match[0].length;
    return true;
  });

  md.renderer.rules.assessment_chip = (tokens: any[], idx: number) => {
    const id = tokens[idx].attrs.find((a: string[]) => a[0] === "id")[1];
    return `<span data-assessment-id="${id}"></span>`;
  };
}

AssessmentChip.config.addStorage = function () {
  return {
    assessments: [] as LinkableAssessment[],
    markdown: {
      serialize(state: any, node: any) {
        state.write(`[[assessment:${node.attrs.id}]]`);
      },
      parse: {
        setup(md: any) {
          assessmentMarkdownPlugin(md);
        },
      },
    },
  };
};
