"use client";

import { useRef, useState } from "react";
import { NoteEditor, type NoteEditorHandle } from "@/components/NoteEditor";
import { NoteSlideView } from "@/components/NoteSlideView";
import { BellTimer, type BellTimerEntry } from "@/components/BellTimer";
import { ResourceSidebar } from "@/components/ResourceSidebar";
import type { TopicResource } from "@/types/database";
import type { LinkableAssessment } from "@/lib/tiptap/assessment-node";

export function NoteWorkspace({
  topicId,
  noteId,
  initialContent,
  initialStatus,
  resources,
  assessments = [],
  placeholder,
  todaysEntries = [],
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
  placeholder?: string;
  todaysEntries?: BellTimerEntry[];
}) {
  // #11 Better Preview: "preview" renders the same live NoteEditor/TipTap
  // doc as "edit" (so it always reflects the current, possibly-unsaved
  // draft -- unlike "present", which deliberately shows only the
  // last-saved version), just with forcePreview turning off editability
  // and hiding the toolbar/mobile-tab chrome. Kept as a sibling of "edit"
  // rather than a NoteEditor-internal-only concept so it's a real,
  // desktop-visible mode in this top pill, not just the mobile-only
  // Write/Preview tab bar NoteEditor already had.
  const [mode, setMode] = useState<"edit" | "preview" | "present">("edit");
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
      <div className="mb-3 inline-flex rounded-lg border border-rule bg-paper p-1">
        <button
          type="button"
          onClick={() => setMode("edit")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            mode === "edit" ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink"
          }`}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => setMode("preview")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            mode === "preview" ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink"
          }`}
        >
          Preview
        </button>
        <button
          type="button"
          onClick={() => setMode("present")}
          disabled={!noteId}
          title={!noteId ? "Save the note once before presenting" : undefined}
          className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-40 ${
            mode === "present" ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink"
          }`}
        >
          Present
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
