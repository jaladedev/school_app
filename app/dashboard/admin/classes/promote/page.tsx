import { createClient } from "@/lib/supabase/server";
import { PromoteStudentsForm } from "@/components/PromoteStudentsForm";
import { formatLevel } from "@/types/database";

export default async function PromoteStudentsPage() {
  const supabase = createClient();

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, arm, education_level, level_number")
    .order("education_level", { ascending: true })
    .order("level_number", { ascending: true });

  const { data: students } = await supabase
    .from("student_profiles")
    .select("id, class_id, profiles(full_name)")
    .not("class_id", "is", null);

  const studentsBySourceClass: Record<string, { id: string; full_name: string }[]> = {};
  for (const s of students ?? []) {
    if (!s.class_id) continue;
    if (!studentsBySourceClass[s.class_id]) studentsBySourceClass[s.class_id] = [];
    studentsBySourceClass[s.class_id].push({
      id: s.id,
      full_name: s.profiles?.full_name ?? "Unknown",
    });
  }

  const classOptions = (classes ?? []).map((c) => ({
    id: c.id,
    name: `${c.name} (${formatLevel(c.education_level, c.level_number)})`,
    arm: c.arm,
  }));

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Promote students</h1>
      <p className="mb-6 text-sm text-ink-soft">
        Move selected students to a new class, have them repeat, or graduate them. Uses the current
        academic year/term from School Settings.
      </p>

      {classes?.length ? (
        <PromoteStudentsForm classes={classOptions} studentsBySourceClass={studentsBySourceClass} />
      ) : (
        <p className="text-sm text-ink-soft">Create at least one class first.</p>
      )}
    </div>
  );
}
