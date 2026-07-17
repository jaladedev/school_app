import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { StudentNotesList } from "@/components/StudentNotesList";
import { redirect } from "next/navigation";

export default async function StudentNotesPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }
  const supabase = createClient();

  const { data: notes } = await supabase
    .from("student_notes")
    .select("id, note_type, content, created_at, profiles(full_name)")
    .eq("student_id", profile.id)
    .eq("visible_to_student", true)
    .order("created_at", { ascending: false });

  const formattedNotes = (notes ?? []).map((n) => ({
    id: n.id,
    note_type: n.note_type,
    content: n.content,
    created_at: n.created_at,
    author_name: n.profiles?.full_name ?? null,
  }));

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">My notes</h1>
      <p className="mb-6 text-sm text-ink-soft">Notes from your teachers and school admin.</p>

      <StudentNotesList notes={formattedNotes} />
    </div>
  );
}
