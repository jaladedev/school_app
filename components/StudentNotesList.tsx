import type { StudentNoteType } from "@/types/database";

const TYPE_STYLES: Record<StudentNoteType, string> = {
  academic: "bg-leaf-soft text-leaf",
  behavioral: "bg-marigold/20 text-marigold-dark",
  commendation: "bg-leaf-soft text-leaf",
  disciplinary: "bg-clay/10 text-clay",
};

export function StudentNotesList({
  notes,
}: {
  notes: {
    id: string;
    note_type: StudentNoteType;
    content: string;
    created_at: string;
    author_name?: string | null;
  }[];
}) {
  if (!notes.length) {
    return <p className="text-sm text-ink-soft">No notes yet.</p>;
  }

  return (
    <div className="space-y-2">
      {notes.map((note) => (
        <div key={note.id} className="rounded-lg border border-rule bg-white p-4">
          <div className="mb-1 flex items-center justify-between">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${TYPE_STYLES[note.note_type]}`}
            >
              {note.note_type}
            </span>
            <span className="text-xs text-ink-soft">
              {new Date(note.created_at).toLocaleDateString()}
            </span>
          </div>
          <p className="text-sm text-ink">{note.content}</p>
          {note.author_name && <p className="mt-1 text-xs text-ink-soft">— {note.author_name}</p>}
        </div>
      ))}
    </div>
  );
}
