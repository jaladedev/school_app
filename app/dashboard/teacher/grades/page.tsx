import Link from "next/link";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { CreateAssessmentForm } from "@/components/CreateAssessmentForm";
import { redirect } from "next/navigation";

export default async function TeacherGradesPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }
  const supabase = createClient();

  const { data: assessments } = await supabase
    .from("assessments")
    .select("*, classes(name, arm), subjects(name)")
    .eq("created_by", profile.id)
    .order("academic_year", { ascending: false })
    .order("term", { ascending: false });

  const { data: teacherProfile } = await supabase
    .from("teacher_profiles")
    .select("subjects_taught")
    .eq("id", profile.id)
    .single();

  const subjectIds = teacherProfile?.subjects_taught ?? [];

  const { data: subjects } = subjectIds.length
    ? await supabase.from("subjects").select("id, name").in("id", subjectIds)
    : { data: [] };

  const { data: timetableEntries } = await supabase
    .from("timetable_entries")
    .select("class_id, classes(id, name, arm)")
    .eq("teacher_id", profile.id);

  const classMap = new Map<string, { id: string; name: string; arm: string | null }>();
  for (const entry of timetableEntries ?? []) {
    const cls = entry.classes;
    if (cls) classMap.set(cls.id, cls);
  }
  const classes = [...classMap.values()];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Grades</h1>
          <p className="text-sm text-ink-soft">
            Assessments you've created. Select one to enter or review scores.
          </p>
        </div>
        <CreateAssessmentForm
          teacherId={profile.id}
          subjects={subjects ?? []}
          classes={classes}
        />
      </div>

      <div className="space-y-2">
        {assessments?.map((a) => (
          <Link
            key={a.id}
            href={`/dashboard/teacher/grades/${a.id}`}
            className="flex items-center justify-between rounded-lg border border-rule bg-white px-4 py-3 transition hover:border-leaf"
          >
            <div>
              <p className="text-ink">{a.title}</p>
              <p className="text-xs text-ink-soft">
                {a.subjects?.name} · {a.classes?.name}{" "}
                {a.classes?.arm} · Term {a.term}
              </p>
            </div>
            <span className="text-sm text-ink-soft">Max {a.max_score}</span>
          </Link>
        ))}

        {!assessments?.length && (
          <p className="text-sm text-ink-soft">
            No assessments yet. Create the standard set above to get started.
          </p>
        )}
      </div>
    </div>
  );
}