import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";

type TimetableRow = {
  id: string;
  weekday: number;
  period_number: number;
  start_time: string;
  end_time: string;
  classes: { id: string; name: string; arm: string | null } | null;
  subjects: { name: string } | null;
};

const WEEKDAY_NAMES = ["", "Mon", "Tue", "Wed", "Thu", "Fri"];
const TERMS = [1, 2, 3];

function hoursBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}

export default async function TeacherProfilePage({
  params,
  searchParams,
}: {
  params: { teacherId: string };
  searchParams: { term?: string };
}) {
  const supabase = createClient();

  const { data: settings } = await supabase
    .from("school_settings")
    .select("current_term")
    .eq("id", 1)
    .single();

  const term = searchParams.term
    ? Number(searchParams.term)
    : settings?.current_term ?? 1;
  const selectedTerm = TERMS.includes(term) ? term : 1;

  const { data: teacherProfile } = await supabase
    .from("teacher_profiles")
    .select("*, profiles(full_name, email, is_active)")
    .eq("id", params.teacherId)
    .single();

  if (!teacherProfile) {
    return (
      <div className="max-w-lg">
        <p className="text-sm text-clay">Teacher not found.</p>
      </div>
    );
  }

  const subjectIds = teacherProfile.subjects_taught ?? [];

  const { data: subjects } = subjectIds.length
    ? await supabase.from("subjects").select("id, name").in("id", subjectIds).order("name")
    : { data: [] };

  const { data: classTeacherOf } = await supabase
    .from("classes")
    .select("id, name, arm")
    .eq("class_teacher_id", params.teacherId);

  const { data: entries } = await supabase
    .from("timetable_entries")
    .select("*, classes(id, name, arm), subjects(name)")
    .eq("teacher_id", params.teacherId)
    .eq("term", selectedTerm)
    .order("weekday", { ascending: true })
    .order("period_number", { ascending: true })
    .returns<TimetableRow[]>();

  const totalHoursPerWeek = (entries ?? []).reduce(
    (sum, e) => sum + hoursBetween(e.start_time, e.end_time),
    0
  );

  const byClass = new Map<
    string,
    { className: string; periodCount: number; hours: number; subjectNames: Set<string> }
  >();

  for (const e of entries ?? []) {
    const classId = e.classes?.id ?? "unknown";
    const className = e.classes ? `${e.classes.name} ${e.classes.arm ?? ""}`.trim() : "Unknown";
    const entry = byClass.get(classId) ?? {
      className,
      periodCount: 0,
      hours: 0,
      subjectNames: new Set<string>(),
    };
    entry.periodCount += 1;
    entry.hours += hoursBetween(e.start_time, e.end_time);
    if (e.subjects?.name) entry.subjectNames.add(e.subjects.name);
    byClass.set(classId, entry);
  }

  const fullName = teacherProfile.profiles?.full_name ?? "Unknown";
  const email = teacherProfile.profiles?.email ?? "";
  const isActive = teacherProfile.profiles?.is_active ?? true;

  return (
    <div className="max-w-2xl">
      <Link href="/dashboard/admin/staff" className="mb-4 inline-block text-sm text-leaf hover:underline">
        ← Back to staff
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">
            {fullName}
            {!isActive && <span className="ml-2 text-sm font-normal text-clay">(deactivated)</span>}
          </h1>
          <p className="text-sm text-ink-soft">{email}</p>
          {teacherProfile.staff_id && (
            <p className="text-xs text-ink-soft">Staff ID: {teacherProfile.staff_id}</p>
          )}
        </div>
      </div>

      <div className="mb-6 flex gap-2">
        {TERMS.map((t) => (
          <Link
            key={t}
            href={`/dashboard/admin/staff/${params.teacherId}?term=${t}`}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
              selectedTerm === t
                ? "border-leaf bg-leaf-soft text-leaf"
                : "border-rule text-ink-soft hover:bg-paper"
            }`}
          >
            Term {t}
          </Link>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-rule bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-soft">Subjects taught</p>
          <p className="font-display text-lg font-semibold text-ink">{subjects?.length ?? 0}</p>
        </div>
        <div className="rounded-lg border border-rule bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-soft">
            Classes (Term {selectedTerm})
          </p>
          <p className="font-display text-lg font-semibold text-ink">{byClass.size}</p>
        </div>
        <div className="rounded-lg border border-rule bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-soft">
            Hours / week (Term {selectedTerm})
          </p>
          <p className="font-display text-lg font-semibold text-ink">
            {totalHoursPerWeek.toFixed(1)}
          </p>
        </div>
      </div>

      {!!classTeacherOf?.length && (
        <div className="mb-6">
          <h2 className="mb-2 font-display text-lg font-semibold text-ink">Class teacher of</h2>
          <div className="flex flex-wrap gap-2">
            {classTeacherOf.map((c) => (
              <span
                key={c.id}
                className="rounded-full bg-leaf-soft px-3 py-1 text-xs font-medium text-leaf"
              >
                {c.name} {c.arm}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mb-6">
        <h2 className="mb-2 font-display text-lg font-semibold text-ink">Subjects</h2>
        <div className="flex flex-wrap gap-2">
          {(subjects ?? []).map((s) => (
            <span
              key={s.id}
              className="rounded-full bg-paper px-3 py-1 text-xs font-medium text-ink-soft"
            >
              {s.name}
            </span>
          ))}
          {!subjects?.length && (
            <EmptyState message="No subjects assigned yet." />
          )}
        </div>
      </div>

      <div className="mb-6">
        <h2 className="mb-2 font-display text-lg font-semibold text-ink">
          Weekly workload — Term {selectedTerm}
        </h2>
        <div className="space-y-2">
          {[...byClass.entries()].map(([classId, info]) => (
            <div
              key={classId}
              className="flex items-center justify-between rounded-lg border border-rule bg-white px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-ink">{info.className}</p>
                <p className="text-xs text-ink-soft">
                  {[...info.subjectNames].join(", ")}
                </p>
              </div>
              <div className="text-right text-sm text-ink-soft">
                {info.periodCount} period{info.periodCount === 1 ? "" : "s"} ·{" "}
                {info.hours.toFixed(1)}h/week
              </div>
            </div>
          ))}
          {!byClass.size && (
            <p className="text-sm text-ink-soft">
              Not scheduled in any timetable yet.
            </p>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-display text-lg font-semibold text-ink">
          Full schedule — Term {selectedTerm}
        </h2>
        <div className="space-y-1">
          {(entries ?? []).map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between rounded-lg border border-rule bg-white px-4 py-2 text-sm"
            >
              <span className="text-ink-soft">
                {WEEKDAY_NAMES[e.weekday]} P{e.period_number}
              </span>
              <span className="text-ink">
                {e.subjects?.name} — {e.classes?.name} {e.classes?.arm}
              </span>
              <span className="text-xs text-ink-soft">
                {e.start_time}–{e.end_time}
              </span>
            </div>
          ))}
          {!entries?.length && (
            <EmptyState message="No timetable entries yet." />
          )}
        </div>
      </div>
    </div>
  );
}