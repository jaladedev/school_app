import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const WEEKDAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default async function StudentTimetablePage() {
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

  const { data: classRow } = await supabase
    .from("classes")
    .select("*")
    .eq("id", studentProfile?.class_id ?? "")
    .single();

  const { data: entries } = await supabase
    .from("timetable_entries")
    .select("*, subjects(name), teacher_profiles(profiles(full_name))")
    .eq("class_id", studentProfile?.class_id ?? "")
    .order("weekday", { ascending: true })
    .order("period_number", { ascending: true });

  const entriesByDay = new Map<number, typeof entries>();
  for (const entry of entries ?? []) {
    entriesByDay.set(entry.weekday, [...(entriesByDay.get(entry.weekday) ?? []), entry]);
  }

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">
        My timetable
      </h1>
      <p className="mb-6 text-sm text-ink-soft">
        {classRow?.name} {classRow?.arm} · {classRow?.academic_year}
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        {[1, 2, 3, 4, 5].map((day) => (
          <div key={day}>
            <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-leaf">
              {WEEKDAY_NAMES[day]}
            </h2>
            <div className="space-y-2">
              {entriesByDay.get(day)?.map((entry: any) => (
                <div
                  key={entry.id}
                  className="rounded-lg border border-rule bg-white p-3 text-sm"
                >
                  <p className="font-medium text-ink">
                    P{entry.period_number} · {entry.subjects?.name}
                  </p>
                  <p className="text-ink-soft">
                    {entry.teacher_profiles?.profiles?.full_name}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {entry.start_time}–{entry.end_time}
                    {entry.room ? ` · ${entry.room}` : ""}
                  </p>
                </div>
              ))}
              {!entriesByDay.get(day)?.length && (
                <p className="text-xs text-ink-soft">No periods</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {!classRow && (
        <p className="text-sm text-ink-soft">
          You aren't enrolled in a class yet — ask an admin to add you.
        </p>
      )}
    </div>
  );
}