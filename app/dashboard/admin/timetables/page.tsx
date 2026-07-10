import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminTimetablesPage() {
  const supabase = createClient();

  const { data: classes } = await supabase
    .from("classes")
    .select("*")
    .order("grade_level", { ascending: true })
    .order("arm", { ascending: true });

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">
        Timetables
      </h1>
      <p className="mb-6 text-sm text-ink-soft">
        Select a class to view or build its weekly schedule.
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {classes?.map((cls) => (
          <Link
            key={cls.id}
            href={`/dashboard/admin/timetables/${cls.id}`}
            className="rounded-xl border border-rule bg-white p-5 transition hover:border-leaf"
          >
            <p className="font-display text-lg font-semibold text-ink">
              {cls.name} {cls.arm}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              Grade {cls.grade_level} · {cls.academic_year}
            </p>
          </Link>
        ))}

        {!classes?.length && (
          <p className="col-span-full text-sm text-ink-soft">
            No classes yet — create one first.
          </p>
        )}
      </div>
    </div>
  );
}
