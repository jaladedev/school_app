import Link from "next/link";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";

export default async function StudentHome() {
  const profile = await getCurrentProfile();
  const supabase = createClient();

  const { data: studentProfile } = await supabase
    .from("student_profiles")
    .select("class_id")
    .eq("id", profile!.id)
    .single();

  const { data: classRow } = await supabase
    .from("classes")
    .select("grade_level, name")
    .eq("id", studentProfile?.class_id ?? "")
    .single();

  const { data: subjects } = await supabase
    .from("subjects")
    .select("*")
    .lte("min_grade_level", classRow?.grade_level ?? 0)
    .gte("max_grade_level", classRow?.grade_level ?? 0);

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">
        My subjects
      </h1>
      <p className="mb-6 text-sm text-ink-soft">
        {classRow?.name ?? "Your class"} — pick a subject to browse topics and notes.
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {subjects?.map((subject) => (
          <Link
            key={subject.id}
            href={`/dashboard/student/subjects/${subject.id}`}
            className="rounded-xl border border-rule bg-white p-5 transition hover:border-leaf hover:shadow-sm"
          >
            <p className="font-display text-lg font-semibold text-ink">
              {subject.name}
            </p>
            {subject.description && (
              <p className="mt-1 text-sm text-ink-soft">{subject.description}</p>
            )}
          </Link>
        ))}

        {!subjects?.length && (
          <p className="col-span-full text-sm text-ink-soft">
            No subjects found yet for your class level.
          </p>
        )}
      </div>
    </div>
  );
}
