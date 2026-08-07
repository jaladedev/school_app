"use client";

import { useRef, useState } from "react";
import { NoteEditor, type NoteEditorHandle } from "@/components/NoteEditor";
import { NoteSlideView } from "@/components/NoteSlideView";
import { TopicContent } from "@/components/TopicContent";
import { BellTimer, type BellTimerEntry } from "@/components/BellTimer";
import { ResourceSidebar } from "@/components/ResourceSidebar";
import { HandoutView } from "@/components/HandoutView";
import { type EducationLevel } from "@/types/database";
import type { TopicResource } from "@/types/database";
import type { LinkableAssessment } from "@/lib/tiptap/assessment-node";
import type { LinkableTopic } from "@/lib/tiptap/topic-link-node";

export function NoteWorkspace({
  topicId,
  noteId,
  initialContent,
  initialStatus,
  resources,
  assessments = [],
  topics = [],
  placeholder,
  todaysEntries = [],
  topicMeta,
}: {
  topicId: string;
  noteId?: string;
  initialContent: string;
  initialStatus: "draft" | "published" | "archived" | "unwritten";
  resources: TopicResource[];
  // Assessments linkable (not embeddable, see #16) from this note --
  // scoped to the topic's subject + matching classes, fetched
  // server-side in page.tsx, open to any teacher's assessments for
  // those classes (not just the current teacher's own).
  assessments?: LinkableAssessment[];
  // Other topics (same subject) linkable via TopicLinkChip -- same
  // "fetched server-side, open to the whole department" shape as
  // `assessments`.
  topics?: LinkableTopic[];
  placeholder?: string;
  todaysEntries?: BellTimerEntry[];
  // Just enough context for the printable Handout header -- title is
  // already shown above this component on the page itself, but that
  // header isn't print-visible (it sits outside NoteWorkspace, and
  // nothing marks it print:hidden either, so it would otherwise print
  // messily alongside the mode pill/toolbar). Optional: Handout mode
  // simply omits the header block if this isn't passed.
  topicMeta?: {
    title: string;
    subjectName?: string | null;
    term: number;
    weekNumber: number;
    weekEndNumber: number;
    educationLevel: EducationLevel;
    levelNumber: number;
  };
}) {
  // #11 Better Preview: "preview" renders the same live NoteEditor/TipTap
  // doc as "edit" (so it always reflects the current, possibly-unsaved
  // draft -- unlike "present", which deliberately shows only the
  // last-saved version), just with forcePreview turning off editability
  // and hiding the toolbar/mobile-tab chrome. Kept as a sibling of "edit"
  // rather than a NoteEditor-internal-only concept so it's a real,
  // desktop-visible mode in this top pill, not just the mobile-only
  // Write/Preview tab bar NoteEditor already had.
  const [mode, setMode] = useState<"edit" | "preview" | "student" | "present" | "handout">("edit");
  const editorRef = useRef<NoteEditorHandle>(null);
  // Seeded from the server-fetched `resources` prop, then kept live by
  // NoteEditor's `onResourcesChange` callback -- so the sidebar reflects
  // resources created this session (a dropped file, a saved diagram)
  // immediately, not just after a `router.refresh()` round trip.
  const [sidebarResources, setSidebarResources] = useState(resources);
  // #32 mobile Resources tab: lifted here (rather than living inside
  // NoteEditor) because the actual Resources content is ResourceSidebar,
  // a sibling of NoteEditor, not a child of it -- NoteEditor only owns
  // the Write/Preview/Resources tab *bar* UI (and hides its own content
  // area when "resources" is active), while this state decides whether
  // ResourceSidebar itself is visible below `lg`. On `lg`+ the sidebar is
  // always shown side-by-side regardless of this tab, same as before.
  const [mobileTab, setMobileTab] = useState<"write" | "preview" | "resources">("write");

  return (
    <div>
      <div className="mb-3 flex gap-1 overflow-x-auto rounded-lg border border-rule bg-paper p-1 print:hidden">
        <button
          type="button"
          onClick={() => setMode("edit")}
          className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${
            mode === "edit" ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink"
          }`}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => setMode("preview")}
          className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${
            mode === "preview" ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink"
          }`}
        >
          Preview
        </button>
        <button
          type="button"
          onClick={() => setMode("student")}
          disabled={!noteId}
          title={!noteId ? "Save the note once before viewing as a student" : undefined}
          className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-40 ${
            mode === "student" ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink"
          }`}
        >
          Student view
        </button>
        <button
          type="button"
          onClick={() => setMode("present")}
          disabled={!noteId}
          title={!noteId ? "Save the note once before presenting" : undefined}
          className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-40 ${
            mode === "present" ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink"
          }`}
        >
          Present
        </button>
        <button
          type="button"
          onClick={() => setMode("handout")}
          disabled={!noteId}
          title={!noteId ? "Save the note once before printing a handout" : undefined}
          className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-40 ${
            mode === "handout" ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink"
          }`}
        >
          Handout
        </button>
      </div>

      {/* Present mode shows the last-saved version of the note (what's
          currently in the DB), not unsaved edits from the editor above —
          switching tabs doesn't lift live textarea state up, so a teacher
          who wants to present their latest changes needs to Save/Publish
          first. That matches how the rest of this page already works
          (e.g. resource lists only refresh after a save triggers
          revalidatePath), rather than introducing a second, editor-only
          notion of "current content". */}
      {mode === "edit" || mode === "preview" ? (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <NoteEditor
              ref={editorRef}
              topicId={topicId}
              noteId={noteId}
              initialContent={initialContent}
              initialStatus={initialStatus}
              resources={resources}
              assessments={assessments}
              topics={topics}
              placeholder={placeholder}
              onResourcesChange={setSidebarResources}
              mobileTab={mobileTab}
              onMobileTabChange={setMobileTab}
              forcePreview={mode === "preview"}
            />
          </div>
          {/* Resource sidebar has nothing to do in a read-only Preview --
              inserting resources requires an editable doc -- so it's
              edit-only, same as the toolbar it pairs with. */}
          {mode === "edit" && (
            <div className={mobileTab === "resources" ? "block" : "hidden lg:block"}>
              <ResourceSidebar resources={sidebarResources} editorRef={editorRef} />
            </div>
          )}
        </div>
      ) : mode === "student" ? (
        // `assessments`/`topics` are the full linkable lists (server-
        // fetched for the "Link assessment"/"Link topic" pickers), not
        // filtered to only what this note actually references -- that's
        // fine, TopicContent's splitContentByMarkers only renders the
        // ones whose id shows up in the content, so passing the full
        // list here is just "what's available to resolve against", same
        // as it already is for the editor's own AssessmentChip/
        // TopicLinkChip storage.
        //
        // linkedAssessments was missing here entirely before -- a
        // teacher's own Student-view preview silently dropped every
        // assessment link, unlike the real student-facing page (which
        // does resolve and pass them). Fixed alongside adding
        // linkedTopics rather than repeating the same gap for it.
        <TopicContent
          content={initialContent}
          resources={resources}
          linkedAssessments={assessments}
          linkedTopics={topics}
        />
      ) : mode === "handout" ? (
        // Reuses the exact same TopicContent render as Student view (math,
        // tables, resources, topic/assessment links all render
        // identically) -- the only difference is the wrapper: a printable
        // card with its own topic/subject/term header (Student view has no
        // need for that, since the student's own page already shows it),
        // and a PrintButton instead of nothing. Same "last-saved content,
        // not live unsaved edits" behavior as Present mode, for the same
        // reason (see the comment above this whole conditional) --
        // `initialContent` either way, not anything lifted from the live
        // editor.
        //
        // Shared with the student-facing handout route (see
        // components/HandoutView.tsx) rather than kept inline here, so
        // both stay in sync.
        <HandoutView
          content={initialContent}
          resources={resources}
          topics={topics}
          topicMeta={topicMeta}
        />
      ) : (
        <>
          {/* Bell timer sits above the slide content in Present mode
              specifically — this is what actually gets projected on the
              classroom TV while a teacher is teaching, so the countdown
              needs to live here rather than on the (teacher-only) dashboard
              a student in the room never sees. */}
          <BellTimer entries={todaysEntries} />
          <NoteSlideView content={initialContent} resources={resources} />
        </>
      )}
    </div>
  );
}
