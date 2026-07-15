import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function StudentHomeworkPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }
  const supabase = createClient();

  const { data: studentProfile } = await supabase
    .from("student_profiles")
    .select("class_id")
    .eq("id", profile.id)
    .single();

  const { data: lessons } = await supabase
    .from("lessons")
    .select(
      "id, lesson_date, homework, homework_status, curriculum_topics(title), timetable_entries(subjects(name))"
    )
    .eq("class_id", studentProfile?.class_id ?? "")
    .not("homework", "is", null)
    .order("lesson_date", { ascending: false })
    .limit(30);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Homework</h1>
      <p className="mb-6 text-sm text-ink-soft">
        Homework given across your subjects, most recent first.
      </p>

      <div className="space-y-2">
        {lessons?.map((l: any) => (
          <div key={l.id} className="rounded-lg border border-rule bg-white p-4">
            <div className="mb-1 flex items-center justify-between gap-3">
              <p className="font-medium text-ink">
                {l.timetable_entries?.subjects?.name ?? "Lesson"}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-ink-soft">{l.lesson_date}</span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    l.homework_status === "reviewed"
                      ? "bg-leaf-soft text-leaf"
                      : "bg-marigold/20 text-marigold-dark"
                  }`}
                >
                  {l.homework_status === "reviewed" ? "Reviewed" : "Given"}
                </span>
              </div>
            </div>
            {l.curriculum_topics?.title && (
              <p className="mb-1 text-xs text-ink-soft">{l.curriculum_topics.title}</p>
            )}
            <p className="text-sm text-ink">{l.homework}</p>
          </div>
        ))}

        {!lessons?.length && (
          <p className="text-sm text-ink-soft">No homework given yet.</p>
        )}
      </div>
    </div>
  );
}