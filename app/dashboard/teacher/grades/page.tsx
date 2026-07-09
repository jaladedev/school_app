import Link from "next/link";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";

export default async function TeacherGradesPage() {
  const profile = await getCurrentProfile();
  const supabase = createClient();

  const { data: assessments } = await supabase
    .from("assessments")
    .select("*, classes(name, arm), subjects(name)")
    .eq("created_by", profile!.id)
    .order("academic_year", { ascending: false })
    .order("term", { ascending: false });

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">
        Grades
      </h1>
      <p className="mb-6 text-sm text-ink-soft">
        Assessments you've created. Select one to enter or review scores.
      </p>

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
                {(a as any).subjects?.name} · {(a as any).classes?.name} {(a as any).classes?.arm} · Term {a.term}
              </p>
            </div>
            <span className="text-sm text-ink-soft">Max {a.max_score}</span>
          </Link>
        ))}

        {!assessments?.length && (
          <p className="text-sm text-ink-soft">
            No assessments yet. Create one in Supabase or via the admin panel to start entering grades.
          </p>
        )}
      </div>
    </div>
  );
}
