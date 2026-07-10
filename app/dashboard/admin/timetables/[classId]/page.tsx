import { createClient } from "@/lib/supabase/server";
import { TimetableEntryForm } from "@/components/TimetableEntryForm";
import { DeleteEntryButton } from "@/components/DeleteEntryButton";

const WEEKDAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default async function ClassTimetablePage({
  params,
}: {
  params: { classId: string };
}) {
  const supabase = createClient();

  const { data: classRow } = await supabase
    .from("classes")
    .select("*")
    .eq("id", params.classId)
    .single();

  const { data: entries } = await supabase
    .from("timetable_entries")
    .select("*, subjects(name), teacher_profiles(profiles(full_name))")
    .eq("class_id", params.classId)
    .order("weekday", { ascending: true })
    .order("period_number", { ascending: true });

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name")
    .order("name");

  const { data: teacherProfiles } = await supabase
    .from("teacher_profiles")
    .select("id, profiles(full_name)");

  const teachers = (teacherProfiles ?? []).map((t: any) => ({
    id: t.id,
    full_name: t.profiles?.full_name ?? "Unknown",
  }));

  const entriesByDay = new Map<number, typeof entries>();
  for (const entry of entries ?? []) {
    entriesByDay.set(entry.weekday, [...(entriesByDay.get(entry.weekday) ?? []), entry]);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">
            {classRow?.name} {classRow?.arm} — Timetable
          </h1>
          <p className="text-sm text-ink-soft">
            {classRow?.academic_year} · Term 1 (default — extend the form to switch terms)
          </p>
        </div>
      </div>

      <TimetableEntryForm
        classId={params.classId}
        academicYear={classRow?.academic_year ?? ""}
        term={1}
        subjects={subjects ?? []}
        teachers={teachers}
      />

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
                  <div className="mt-1">
                    <DeleteEntryButton entryId={entry.id} />
                  </div>
                </div>
              ))}
              {!entriesByDay.get(day)?.length && (
                <p className="text-xs text-ink-soft">No periods</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
