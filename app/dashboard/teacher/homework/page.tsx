import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { HomeworkStatusToggle } from "@/components/HomeworkStatusToggle";
import { redirect } from "next/navigation";
import type { HomeworkStatus } from "@/types/database";

type HomeworkLessonRow = {
  id: string;
  lesson_date: string;
  homework: string | null;
  homework_status: HomeworkStatus;
  classes: { name: string; arm: string | null } | null;
  curriculum_topics: { title: string } | null;
  timetable_entries: { subjects: { name: string } | null } | null;
};

function summaryLine(givenCount: number, reviewedCount: number): string {
  if (givenCount === 0 && reviewedCount === 0) return "All homework has been graded.";
  const parts: string[] = [];
  if (givenCount > 0) parts.push(`${givenCount} not yet reviewed`);
  if (reviewedCount > 0) parts.push(`${reviewedCount} reviewed, awaiting a grade`);
  return parts.join(" · ") + ".";
}

export default async function TeacherHomeworkPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }
  const supabase = createClient();

  const { data: lessons } = await supabase
    .from("lessons")
    .select(
      "id, lesson_date, homework, homework_status, classes(name, arm), curriculum_topics(title), timetable_entries(subjects(name))"
    )
    .eq("teacher_id", profile.id)
    .not("homework", "is", null)
    .order("lesson_date", { ascending: false })
    .limit(50)
    .returns<HomeworkLessonRow[]>();

  const givenCount = (lessons ?? []).filter((l) => l.homework_status === "given").length;
  const reviewedCount = (lessons ?? []).filter((l) => l.homework_status === "reviewed").length;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Homework given</h1>
      <p className="mb-6 text-sm text-ink-soft">{summaryLine(givenCount, reviewedCount)}</p>

      <div className="space-y-2">
        {lessons?.map((l) => (
          <div key={l.id} className="rounded-lg border border-rule bg-white p-4">
            <div className="mb-1 flex items-center justify-between gap-3">
              <p className="font-medium text-ink">
                {l.timetable_entries?.subjects?.name ?? "Lesson"} — {l.classes?.name}{" "}
                {l.classes?.arm}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-ink-soft">{l.lesson_date}</span>
                <HomeworkStatusToggle lessonId={l.id} status={l.homework_status} />
              </div>
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
