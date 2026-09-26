import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLinkedChildren, resolveSelectedChild } from "@/lib/parent";
import { ChildSwitcher } from "@/components/ChildSwitcher";
import { formatKobo, homeworkDueStatus } from "@/types/database";

type ChildDigest = {
  id: string;
  fullName: string;
  attendancePercent: number | null;
  balanceKobo: number;
  gradeAveragePercent: number | null;
  overdueHomeworkCount: number;
  dueSoonHomeworkCount: number;
};

// One-round-trip-per-table summary across every linked child, for the
// "all my children" digest. Only worth building when there's more than
// one child to compare -- a single-child parent already gets this same
// data (in more detail) from the per-child cards below.
async function buildDigest(childIds: string[]): Promise<Map<string, ChildDigest>> {
  const supabase = createClient();
  const digest = new Map<string, ChildDigest>();

  const { data: studentProfiles } = await supabase
    .from("student_profiles")
    .select("id, class_id, profiles(full_name)")
    .in("id", childIds);

  for (const sp of studentProfiles ?? []) {
    digest.set(sp.id, {
      id: sp.id,
      fullName: sp.profiles?.full_name ?? "Unknown",
      attendancePercent: null,
      balanceKobo: 0,
      gradeAveragePercent: null,
      overdueHomeworkCount: 0,
      dueSoonHomeworkCount: 0,
    });
  }

  const { data: attendanceRows } = await supabase
    .from("attendance")
    .select("student_id, status")
    .in("student_id", childIds);

  for (const id of childIds) {
    const rows = (attendanceRows ?? []).filter((r) => r.student_id === id);
    const entry = digest.get(id);
    if (entry && rows.length > 0) {
      entry.attendancePercent = Math.round(
        (rows.filter((r) => r.status === "present").length / rows.length) * 100
      );
    }
  }

  const { data: invoices } = await supabase
    .from("invoices")
    .select("student_id, total_amount_kobo, discount_kobo, amount_paid_kobo")
    .in("student_id", childIds)
    .is("voided_at", null);

  for (const inv of invoices ?? []) {
    const entry = digest.get(inv.student_id);
    if (entry) {
      entry.balanceKobo += inv.total_amount_kobo - inv.discount_kobo - inv.amount_paid_kobo;
    }
  }

  const { data: grades } = await supabase
    .from("grades")
    .select("student_id, score, assessments(max_score)")
    .in("student_id", childIds)
    .eq("moderation_status", "approved");

  for (const id of childIds) {
    const rows = (grades ?? []).filter((g) => g.student_id === id && g.assessments?.max_score);
    const entry = digest.get(id);
    if (entry && rows.length > 0) {
      const percentSum = rows.reduce(
        (sum, g) => sum + (g.score / (g.assessments!.max_score as number)) * 100,
        0
      );
      entry.gradeAveragePercent = Math.round(percentSum / rows.length);
    }
  }

  const classIds = [
    ...new Set((studentProfiles ?? []).map((sp) => sp.class_id).filter((id): id is string => !!id)),
  ];
  const { data: lessons } = classIds.length
    ? await supabase
        .from("lessons")
        .select("id, class_id, homework_due_at, homework_status")
        .in("class_id", classIds)
        .not("homework_due_at", "is", null)
    : { data: [] };

  const lessonIds = (lessons ?? []).map((l) => l.id);
  const { data: submissions } = lessonIds.length
    ? await supabase
        .from("homework_submissions")
        .select("lesson_id, student_id")
        .in("lesson_id", lessonIds)
        .in("student_id", childIds)
    : { data: [] };

  const submittedKey = new Set((submissions ?? []).map((s) => `${s.lesson_id}:${s.student_id}`));

  for (const sp of studentProfiles ?? []) {
    const entry = digest.get(sp.id);
    if (!entry) continue;
    for (const lesson of (lessons ?? []).filter((l) => l.class_id === sp.class_id)) {
      // A submission already on file means this student is done with it,
      // regardless of whether the teacher has reviewed/graded it yet --
      // "overdue"/"due soon" is about the student's action, not the
      // teacher's, so only count lessons with nothing submitted.
      if (submittedKey.has(`${lesson.id}:${sp.id}`)) continue;
      const status = homeworkDueStatus(lesson);
      if (status === "overdue") entry.overdueHomeworkCount++;
      else if (status === "due_today" || status === "due_soon") entry.dueSoonHomeworkCount++;
    }
  }

  return digest;
}

export default async function ParentHome({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>;
}) {
  const resolvedSearchParams = await searchParams;

  const children = await getLinkedChildren();
  const selected = await resolveSelectedChild(resolvedSearchParams.child);

  if (!selected) {
    return (
      <div>
        <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Welcome</h1>
        <p className="text-sm text-ink-soft">
          No children are linked to your account yet — contact the school office.
        </p>
      </div>
    );
  }

  const digest = children.length > 1 ? await buildDigest(children.map((c) => c.id)) : null;

  const supabase = createClient();

  const { data: attendanceRows } = await supabase
    .from("attendance")
    .select("status")
    .eq("student_id", selected.id);

  const total = attendanceRows?.length ?? 0;
  const present = (attendanceRows ?? []).filter((r) => r.status === "present").length;
  const attendancePercent = total > 0 ? Math.round((present / total) * 100) : null;

  const { data: invoices } = await supabase
    .from("invoices")
    .select("total_amount_kobo, discount_kobo, amount_paid_kobo")
    .eq("student_id", selected.id)
    .is("voided_at", null);

  const balance = (invoices ?? []).reduce(
    (sum, i) => sum + (i.total_amount_kobo - i.discount_kobo - i.amount_paid_kobo),
    0
  );

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">
        {digest ? "My children" : selected.fullName}
      </h1>

      {digest && (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {children.map((c) => {
            const d = digest.get(c.id);
            return (
              <Link
                key={c.id}
                href={`/dashboard/parent?child=${c.id}`}
                className={`rounded-xl border bg-white p-4 transition hover:border-leaf ${
                  c.id === selected.id ? "border-leaf" : "border-rule"
                }`}
              >
                <p className="font-medium text-ink">{c.fullName}</p>
                <p className="mb-2 text-xs text-ink-soft">{c.className ?? "—"}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span className="text-ink-soft">
                    Attendance:{" "}
                    <span className="font-medium text-ink">
                      {d?.attendancePercent !== null && d?.attendancePercent !== undefined
                        ? `${d.attendancePercent}%`
                        : "—"}
                    </span>
                  </span>
                  <span className="text-ink-soft">
                    Grades:{" "}
                    <span className="font-medium text-ink">
                      {d?.gradeAveragePercent !== null && d?.gradeAveragePercent !== undefined
                        ? `${d.gradeAveragePercent}%`
                        : "—"}
                    </span>
                  </span>
                  <span className={d && d.balanceKobo > 0 ? "text-clay" : "text-ink-soft"}>
                    Balance: <span className="font-medium">{formatKobo(d?.balanceKobo ?? 0)}</span>
                  </span>
                </div>
                {d && (d.overdueHomeworkCount > 0 || d.dueSoonHomeworkCount > 0) && (
                  <p className="mt-2 text-xs font-medium text-clay">
                    {d.overdueHomeworkCount > 0
                      ? `${d.overdueHomeworkCount} homework overdue`
                      : `${d.dueSoonHomeworkCount} homework due soon`}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}

      <ChildSwitcher linkedChildren={children} selectedChildId={selected.id} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-rule bg-white p-4">
          <p className="mb-1 text-xs uppercase tracking-wide text-ink-soft">Attendance</p>
          <p className="font-display text-2xl font-semibold text-ink">
            {attendancePercent !== null ? `${attendancePercent}%` : "—"}
          </p>
          <Link
            href={`/dashboard/parent/attendance?child=${selected.id}`}
            className="mt-1 inline-block text-xs text-leaf hover:underline"
          >
            View details →
          </Link>
        </div>

        <div className="rounded-xl border border-rule bg-white p-4">
          <p className="mb-1 text-xs uppercase tracking-wide text-ink-soft">Fee balance</p>
          <p
            className={`font-display text-2xl font-semibold ${balance > 0 ? "text-clay" : "text-leaf"}`}
          >
            {formatKobo(balance)}
          </p>
          <Link
            href={`/dashboard/parent/fees?child=${selected.id}`}
            className="mt-1 inline-block text-xs text-leaf hover:underline"
          >
            View invoices →
          </Link>
        </div>

        <div className="rounded-xl border border-rule bg-white p-4">
          <p className="mb-1 text-xs uppercase tracking-wide text-ink-soft">Report card</p>
          <p className="text-sm text-ink-soft">See grades and class position.</p>
          <Link
            href={`/dashboard/parent/report-card?child=${selected.id}`}
            className="mt-1 inline-block text-xs text-leaf hover:underline"
          >
            View report card →
          </Link>
        </div>
      </div>
    </div>
  );
}
