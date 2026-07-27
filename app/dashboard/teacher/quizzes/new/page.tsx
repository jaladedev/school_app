import { createClient } from "@/lib/supabase/server";
import { QuizBuilder } from "@/components/QuizBuilder";
import { redirect } from "next/navigation";

export default async function NewQuizPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: teacherProfile } = await supabase
    .from("teacher_profiles")
    .select("subjects_taught")
    .eq("id", user.id)
    .single();

  const assignedSubjectIds = teacherProfile?.subjects_taught ?? [];

  const { data: allSubjects } = await supabase.from("subjects").select("id, name").order("name");
  const subjects = (allSubjects ?? []).filter((s) => assignedSubjectIds.includes(s.id));

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, arm")
    .eq("is_archived", false)
    .order("name");
  const { data: settings } = await supabase
    .from("school_settings")
    .select("current_academic_year, current_term")
    .eq("id", 1)
    .single();

  if (!subjects.length) {
    return (
      <div>
        <h1 className="mb-1 font-display text-2xl font-semibold text-ink">New Quiz</h1>
        <p className="text-sm text-ink-soft">
          You don&apos;t have any subjects assigned yet. Contact an admin to get set up before
          creating a quiz.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">New Quiz</h1>
      <p className="mb-6 text-sm text-ink-soft">
        Build a timed, auto-graded quiz. Scores go through the usual grade moderation flow once
        submitted.
      </p>
      <QuizBuilder
        subjects={subjects}
        classes={(classes ?? []).map((c) => ({
          id: c.id,
          label: `${c.name} ${c.arm ?? ""}`.trim(),
        }))}
        academicYear={settings?.current_academic_year ?? ""}
        term={settings?.current_term ?? 1}
      />
    </div>
  );
}
