import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";

const TERMS = [1, 2, 3];
const WEEKDAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

type ScheduleEntry = {
  teacher_id: string;
  weekday: number;
  period_number: number;
  start_time: string;
  end_time: string;
  classes: { name: string; arm: string | null } | null;
  subjects: { name: string } | null;
  teacher_profiles: { profiles: { full_name: string } | null } | null;
};

function parseTerm(raw: string | undefined): number {
  const term = Number(raw ?? 1);
  return TERMS.includes(term) ? term : 1;
}

export default async function TeacherSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>;
}) {
  const resolvedSearchParams = await searchParams;

  const supabase = createClient();
  const term = parseTerm(resolvedSearchParams.term);

  const { data: settings } = await supabase
    .from("school_settings")
    .select("current_academic_year")
    .eq("id", 1)
    .single();

  const { data: entries } = await supabase
    .from("timetable_entries")
    .select(
      "teacher_id, weekday, period_number, start_time, end_time, classes(name, arm), subjects(name), teacher_profiles(profiles(full_name))"
    )
    .eq("term", term)
    .eq("academic_year", settings?.current_academic_year ?? "")
    .order("weekday", { ascending: true })
    .order("period_number", { ascending: true })
    .returns<ScheduleEntry[]>();

  const schedules = new Map<string, { name: string; entries: ScheduleEntry[] }>();
  for (const entry of entries ?? []) {
    const current = schedules.get(entry.teacher_id) ?? {
      name: entry.teacher_profiles?.profiles?.full_name ?? "Unknown teacher",
      entries: [],
    };
    current.entries.push(entry);
    schedules.set(entry.teacher_id, current);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/dashboard/admin/timetables" className="text-sm text-leaf hover:underline">
            ← Back to timetables
          </Link>
          <h1 className="mt-2 font-display text-2xl font-semibold text-ink">Teacher schedules</h1>
          <p className="text-sm text-ink-soft">
            {settings?.current_academic_year ?? "Current year"} · Term {term}. Duplicate slots are
            highlighted if any exist.
          </p>
        </div>
        <div className="flex gap-2">
          {TERMS.map((value) => (
            <Link
              key={value}
              href={`/dashboard/admin/timetables/teachers?term=${value}`}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                term === value
                  ? "border-leaf bg-leaf-soft text-leaf"
                  : "border-rule text-ink-soft hover:bg-paper"
              }`}
            >
              Term {value}
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-5">
        {[...schedules.entries()].map(([teacherId, schedule]) => {
          const occupiedSlots = new Map<string, ScheduleEntry[]>();
          for (const entry of schedule.entries) {
            const key = `${entry.weekday}-${entry.period_number}`;
            occupiedSlots.set(key, [...(occupiedSlots.get(key) ?? []), entry]);
          }
          const conflictCount = [...occupiedSlots.values()].filter(
            (slot) => slot.length > 1
          ).length;

          return (
            <section key={teacherId} className="rounded-xl border border-rule bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-lg font-semibold text-ink">{schedule.name}</h2>
                <p className={conflictCount ? "text-sm text-clay" : "text-sm text-leaf"}>
                  {conflictCount
                    ? `${conflictCount} conflicting slot(s)`
                    : "No scheduling conflicts"}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {[1, 2, 3, 4, 5].map((weekday) => (
                  <div key={weekday} className="rounded-lg bg-paper p-3">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-leaf">
                      {WEEKDAY_NAMES[weekday]}
                    </h3>
                    <div className="space-y-2">
                      {schedule.entries
                        .filter((entry) => entry.weekday === weekday)
                        .map((entry) => {
                          const conflict =
                            (occupiedSlots.get(`${entry.weekday}-${entry.period_number}`) ?? [])
                              .length > 1;
                          return (
                            <div
                              key={`${entry.teacher_id}-${entry.weekday}-${entry.period_number}-${entry.classes?.name}`}
                              className={`rounded border p-2 text-xs ${
                                conflict ? "border-clay bg-clay/10" : "border-rule bg-white"
                              }`}
                            >
                              <p className="font-medium text-ink">
                                P{entry.period_number} · {entry.subjects?.name ?? "Unknown subject"}
                              </p>
                              <p className="text-ink-soft">
                                {entry.classes?.name} {entry.classes?.arm}
                              </p>
                              <p className="text-ink-soft">
                                {entry.start_time}–{entry.end_time}
                              </p>
                            </div>
                          );
                        })}
                      {!schedule.entries.some((entry) => entry.weekday === weekday) && (
                        <p className="text-xs text-ink-soft">Free</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
        {!schedules.size && (
          <EmptyState message="No teacher timetable entries for this term yet." />
        )}
      </div>
    </div>
  );
}
