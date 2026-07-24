import { createClient } from "@/lib/supabase/server";
import { TimetableEntryForm } from "@/components/TimetableEntryForm";
import { DeleteEntryButton } from "@/components/DeleteEntryButton";
import { CopyTimetableButton } from "@/components/CopyTimetableButton";
import { PrintButton } from "@/components/PrintButton";
import Link from "next/link";

const WEEKDAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const TERMS = [1, 2, 3];

function parseTerm(raw: string | undefined): number {
  const n = Number(raw ?? 1);
  return TERMS.includes(n) ? n : 1;
}

type EntryRow = {
  id: string;
  weekday: number;
  period_number: number;
  start_time: string;
  end_time: string;
  room: string | null;
  subjects: { name: string } | null;
  teacher_profiles: { profiles: { full_name: string } | null } | null;
};

export default async function ClassTimetablePage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ term?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const resolvedParams = await params;

  const supabase = createClient();
  const term = parseTerm(resolvedSearchParams.term);

  const { data: classRow } = await supabase
    .from("classes")
    .select("*")
    .eq("id", resolvedParams.classId)
    .single();

  const { data: entries } = await supabase
    .from("timetable_entries")
    .select("*, subjects(name), teacher_profiles(profiles(full_name))")
    .eq("class_id", resolvedParams.classId)
    .eq("term", term)
    .order("weekday", { ascending: true })
    .order("period_number", { ascending: true })
    .returns<EntryRow[]>();

  // Which other terms actually have periods, so "Copy from Term X" only
  // ever offers terms that have something worth copying.
  const { data: termCounts } = await supabase
    .from("timetable_entries")
    .select("term")
    .eq("class_id", resolvedParams.classId)
    .neq("term", term);

  const termsWithData = [...new Set((termCounts ?? []).map((t) => t.term))].sort();

  const { data: subjects } = await supabase.from("subjects").select("id, name").order("name");

  const { data: teacherProfiles } = await supabase
    .from("teacher_profiles")
    .select("id, profiles(full_name)");

  const teachers = (teacherProfiles ?? []).map((t) => ({
    id: t.id,
    full_name: t.profiles?.full_name ?? "Unknown",
  }));

  const entriesByDay = new Map<number, EntryRow[]>();
  for (const entry of entries ?? []) {
    entriesByDay.set(entry.weekday, [...(entriesByDay.get(entry.weekday) ?? []), entry]);
  }
  const entryBySlot = new Map(
    (entries ?? []).map((entry) => [`${entry.period_number}-${entry.weekday}`, entry])
  );
  const periodNumbers = [...new Set((entries ?? []).map((entry) => entry.period_number))].sort(
    (a, b) => a - b
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">
            {classRow?.name} {classRow?.arm} — Timetable
          </h1>
          <p className="text-sm text-ink-soft">{classRow?.academic_year}</p>
        </div>
        <PrintButton />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4 print:hidden">
        <div className="flex gap-2">
          {TERMS.map((t) => (
            <Link
              key={t}
              href={`/dashboard/admin/timetables/${resolvedParams.classId}?term=${t}`}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                term === t
                  ? "border-leaf bg-leaf-soft text-leaf"
                  : "border-rule text-ink-soft hover:bg-paper"
              }`}
            >
              Term {t}
            </Link>
          ))}
        </div>

        {termsWithData.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {termsWithData.map((sourceTerm) => (
              <CopyTimetableButton
                key={sourceTerm}
                classId={resolvedParams.classId}
                fromTerm={sourceTerm}
                toTerm={term}
              />
            ))}
          </div>
        )}
      </div>

      <div className="print:hidden">
        <TimetableEntryForm
          classId={resolvedParams.classId}
          academicYear={classRow?.academic_year ?? ""}
          term={term}
          subjects={subjects ?? []}
          teachers={teachers}
        />
      </div>

      <div className="hidden">
        {[1, 2, 3, 4, 5].map((day) => (
          <div key={day}>
            <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-leaf">
              {WEEKDAY_NAMES[day]}
            </h2>
            <div className="space-y-2">
              {entriesByDay.get(day)?.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-rule bg-white p-3 text-sm">
                  <p className="font-medium text-ink">
                    P{entry.period_number} · {entry.subjects?.name}
                  </p>
                  <p className="text-ink-soft">{entry.teacher_profiles?.profiles?.full_name}</p>
                  <p className="text-xs text-ink-soft">
                    {entry.start_time}–{entry.end_time}
                    {entry.room ? ` · ${entry.room}` : ""}
                  </p>
                  <div className="mt-1 print:hidden">
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

      <div className="overflow-x-auto rounded-xl border border-rule bg-white">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-rule bg-paper text-left">
              <th className="w-28 px-3 py-3 text-xs uppercase tracking-wide text-ink-soft">
                Period
              </th>
              {[1, 2, 3, 4, 5].map((day) => (
                <th
                  key={day}
                  className="min-w-40 px-3 py-3 text-xs uppercase tracking-wide text-leaf"
                >
                  {WEEKDAY_NAMES[day]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periodNumbers.map((periodNumber) => (
              <tr key={periodNumber} className="border-b border-rule last:border-0">
                <th className="whitespace-nowrap bg-paper/50 px-3 py-3 text-left align-top text-xs font-medium text-ink-soft">
                  P{periodNumber}
                </th>
                {[1, 2, 3, 4, 5].map((day) => {
                  const entry = entryBySlot.get(`${periodNumber}-${day}`);
                  return (
                    <td key={day} className="border-l border-rule p-2 align-top">
                      {entry ? (
                        <div className="rounded-lg bg-leaf-soft/40 p-2">
                          <p className="font-medium text-ink">{entry.subjects?.name}</p>
                          <p className="text-xs text-ink-soft">
                            {entry.teacher_profiles?.profiles?.full_name}
                          </p>
                          <p className="mt-1 text-xs text-ink-soft">
                            {entry.start_time}–{entry.end_time}
                            {entry.room ? ` · ${entry.room}` : ""}
                          </p>
                          <div className="mt-2 print:hidden">
                            <DeleteEntryButton entryId={entry.id} />
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-ink-soft">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {!periodNumbers.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-ink-soft">
                  No periods have been added for this term.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
