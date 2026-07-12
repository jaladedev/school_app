import { createClient, getCurrentProfile } from "@/lib/supabase/server";

export default async function TeacherHomeworkPage() {
  const profile = await getCurrentProfile();
  const supabase = createClient();

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, lesson_date, homework, classes(name, arm), curriculum_topics(title), timetable_entries(subjects(name))")
    .eq("teacher_id", profile!.id)
    .not("homework", "is", null)
    .order("lesson_date", { ascending: false })
    .limit(50);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Homework given</h1>
      <p className="mb-6 text-sm text-ink-soft">
        Homework you've set across your lessons, most recent first.
      </p>

      <div className="space-y-2">
        {lessons?.map((l: any) => (
          <div key={l.id} className="rounded-lg border border-rule bg-white p-4">
            <div className="mb-1 flex items-center justify-between">
              <p className="font-medium text-ink">
                {l.timetable_entries?.subjects?.name ?? "Lesson"} — {l.classes?.name}{" "}
                {l.classes?.arm}
              </p>
              <span className="text-xs text-ink-soft">{l.lesson_date}</span>
            </div>
            {l.curriculum_topics?.title && (
              <p className="mb-1 text-xs text-ink-soft">{l.curriculum_topics.title}</p>
            )}
            <p className="text-sm text-ink">{l.homework}</p>
          </div>
        ))}

        {!lessons?.length && (
          <p className="text-sm text-ink-soft">
            No homework logged yet — add it when logging a lesson.
          </p>
        )}
      </div>
    </div>
  );
}