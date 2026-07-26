import { createClient } from "@/lib/supabase/server";
import { QuizBuilder } from "@/components/QuizBuilder";

export default async function NewQuizPage() {
  const supabase = createClient();

  const { data: subjects } = await supabase.from("subjects").select("id, name").order("name");
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

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">New Quiz</h1>
      <p className="mb-6 text-sm text-ink-soft">
        Build a timed, auto-graded quiz. Scores go through the usual grade moderation flow once
        submitted.
      </p>
      <QuizBuilder
        subjects={subjects ?? []}
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
