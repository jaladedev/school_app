import { getCurrentProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NoteSearch } from "@/components/NoteSearch";

export default async function TeacherNoteSearchPage() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Search notes</h1>
      <p className="mb-6 text-sm text-ink-soft">
        Search across every topic note you have access to — your own subjects, plus anything else
        your role can see.
      </p>
      <NoteSearch resultBasePath="/dashboard/teacher/notes" />
    </div>
  );
}
