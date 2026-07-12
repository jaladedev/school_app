import { createClient } from "@/lib/supabase/server";
import { StudentNoteForm } from "@/components/StudentNoteForm";
import { StudentNotesList } from "@/components/StudentNotesList";

export default async function AdminStudentNotesPage({
  params,
}: {
  params: { studentId: string };
}) {
  const supabase = createClient();

  const { data: studentProfile } = await supabase
    .from("student_profiles")
    .select("profiles(full_name)")
    .eq("id", params.studentId)
    .single();

  const { data: notes } = await supabase
    .from("student_notes")
    .select("id, note_type, content, created_at, profiles(full_name)")
    .eq("student_id", params.studentId)
    .order("created_at", { ascending: false });

  const formattedNotes = (notes ?? []).map((n) => ({
    id: n.id,
    note_type: n.note_type,
    content: n.content,
    created_at: n.created_at,
    author_name: (n as any).profiles?.full_name ?? null,
  }));

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">
        Notes — {(studentProfile as any)?.profiles?.full_name ?? "Student"}
      </h1>
      <p className="mb-6 text-sm text-ink-soft">
        Behavioral, academic, and commendation notes for this student.
      </p>

      <div className="mb-6">
        <StudentNoteForm studentId={params.studentId} />
      </div>

      <StudentNotesList notes={formattedNotes} />
    </div>
  );
}