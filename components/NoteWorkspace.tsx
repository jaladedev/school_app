"use client";

import { useState } from "react";
import { NoteEditor } from "@/components/NoteEditor";
import { NoteSlideView } from "@/components/NoteSlideView";
import { BellTimer, type BellTimerEntry } from "@/components/BellTimer";
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
        <NoteEditor
          topicId={topicId}
          noteId={noteId}
          initialContent={initialContent}
          initialStatus={initialStatus}
          resources={resources}
          placeholder={placeholder}
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
