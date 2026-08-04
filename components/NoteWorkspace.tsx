"use client";

import { useRef, useState } from "react";
import { NoteEditor, type NoteEditorHandle } from "@/components/NoteEditor";
import { NoteSlideView } from "@/components/NoteSlideView";
import { BellTimer, type BellTimerEntry } from "@/components/BellTimer";
import { ResourceSidebar } from "@/components/ResourceSidebar";
import type { TopicResource } from "@/types/database";

export function NoteWorkspace({
  topicId,
  noteId,
  initialContent,
  initialStatus,
  resources,
  placeholder,
  todaysEntries = [],
}: {
  topicId: string;
  noteId?: string;
  initialContent: string;
  initialStatus: "draft" | "published" | "archived" | "unwritten";
  resources: TopicResource[];
  placeholder?: string;
  todaysEntries?: BellTimerEntry[];
}) {
  const [mode, setMode] = useState<"edit" | "present">("edit");
  const editorRef = useRef<NoteEditorHandle>(null);
  // Seeded from the server-fetched `resources` prop, then kept live by
  // NoteEditor's `onResourcesChange` callback -- so the sidebar reflects
  // resources created this session (a dropped file, a saved diagram)
  // immediately, not just after a `router.refresh()` round trip.
  const [sidebarResources, setSidebarResources] = useState(resources);

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
      {mode === "edit" ? (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <NoteEditor
              ref={editorRef}
              topicId={topicId}
              noteId={noteId}
              initialContent={initialContent}
              initialStatus={initialStatus}
              resources={resources}
              placeholder={placeholder}
              onResourcesChange={setSidebarResources}
            />
          </div>
          <ResourceSidebar resources={sidebarResources} editorRef={editorRef} />
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
