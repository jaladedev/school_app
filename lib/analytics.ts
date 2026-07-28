import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = ReturnType<typeof createClient>;

// ---------- Enrollment trend ----------

export type EnrollmentTrendPoint = { label: string; count: number };

// Cap how many distinct (academic_year, term) points these two trends will
// ever render. Without this, every term the school has ever existed for
// gets its own bar — fine at low data volumes, but unbounded growth over
// many years of use. Keeping the most *recent* N terms (not just the first
// N found) since that's what's actually useful on a dashboard.
const TERM_TREND_CAP = 12;

function capToRecentTerms<T extends { label: string }>(points: T[]): T[] {
  // labels sort correctly as strings here because they're built as
  // `${academic_year} · Term ${term}` and academic years are "YYYY/YYYY"-
  // style strings that sort chronologically; term 1/2/3 sorts correctly
  // within a year too since it's a single digit.
  const sorted = [...points].sort((a, b) => a.label.localeCompare(b.label));
  return sorted.slice(-TERM_TREND_CAP);
}

export async function getEnrollmentTrend(
  supabase: SupabaseServerClient
): Promise<EnrollmentTrendPoint[]> {
  const { data } = await supabase.from("enrollments").select("academic_year, term");

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const key = `${row.academic_year} · Term ${row.term}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const points = [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return capToRecentTerms(points);
}

// ---------- Fee collection vs defaulters ----------

export type FeeCollectionPoint = {
  label: string;
  billedKobo: number;
  collectedKobo: number;
  outstandingKobo: number;
  unpaidCount: number;
  invoiceCount: number;
};

export async function getFeeCollectionTrend(
  supabase: SupabaseServerClient
): Promise<FeeCollectionPoint[]> {
  const { data } = await supabase
    .from("invoices")
    .select("academic_year, term, total_amount_kobo, discount_kobo, amount_paid_kobo, status")
    .is("voided_at", null);

  const byTerm = new Map<string, FeeCollectionPoint>();
  for (const row of data ?? []) {
    const key = `${row.academic_year} · Term ${row.term}`;
    const point = byTerm.get(key) ?? {
      label: key,
      billedKobo: 0,
      collectedKobo: 0,
      outstandingKobo: 0,
      unpaidCount: 0,
      invoiceCount: 0,
    };
    const netBilled = row.total_amount_kobo - row.discount_kobo;
    point.billedKobo += netBilled;
    point.collectedKobo += row.amount_paid_kobo;
    point.outstandingKobo += netBilled - row.amount_paid_kobo;
    point.invoiceCount += 1;
    if (row.status !== "paid") point.unpaidCount += 1;
    byTerm.set(key, point);
  }

  return capToRecentTerms([...byTerm.values()].sort((a, b) => a.label.localeCompare(b.label)));
}

// ---------- Average grades by subject and class ----------

export type SubjectGradeAverage = {
  subjectName: string;
  className: string;
  averagePercent: number;
  gradeCount: number;
};

export async function getAverageGradesBySubject(
  supabase: SupabaseServerClient,
  academicYear: string,
  term: number
): Promise<SubjectGradeAverage[]> {
  const { data: assessments } = await supabase
    .from("assessments")
    .select("id, subject_id, class_id, max_score, subjects(name), classes(name, arm)")
    .eq("academic_year", academicYear)
    .eq("term", term);

  const assessmentIds = (assessments ?? []).map((a) => a.id);
  if (!assessmentIds.length) return [];

  const { data: grades } = await supabase
    .from("grades")
    .select("assessment_id, score")
    .in("assessment_id", assessmentIds)
    .eq("moderation_status", "approved");

  const assessmentById = new Map((assessments ?? []).map((a) => [a.id, a]));
  // Keyed by subject_id + class_id together — this is the actual change
  // from before, which only keyed by subject_id and silently merged every
  // class's grades for a subject into one bar.
  const bySubjectAndClass = new Map<
    string,
    { subjectName: string; className: string; totalPercent: number; count: number }
  >();

  for (const g of grades ?? []) {
    const assessment = assessmentById.get(g.assessment_id);
    if (!assessment || !assessment.max_score) continue;
    const subjectName = assessment.subjects?.name ?? "Unknown subject";
    const className = assessment.classes
      ? `${assessment.classes.name}${assessment.classes.arm ? ` ${assessment.classes.arm}` : ""}`
      : "Unknown class";
    const key = `${assessment.subject_id}::${assessment.class_id}`;
    const percent = (g.score / assessment.max_score) * 100;
    const entry = bySubjectAndClass.get(key) ?? {
      subjectName,
      className,
      totalPercent: 0,
      count: 0,
    };
    entry.totalPercent += percent;
    entry.count += 1;
    bySubjectAndClass.set(key, entry);
  }

  return [...bySubjectAndClass.values()]
    .map((e) => ({
      subjectName: e.subjectName,
      className: e.className,
      averagePercent: Math.round(e.totalPercent / e.count),
      gradeCount: e.count,
    }))
    .sort((a, b) => b.averagePercent - a.averagePercent);
}

// ---------- Attendance rate trend ----------

export type AttendanceWeekPoint = { label: string; ratePercent: number; totalMarked: number };

/** Fallback window if the term start date hasn't been set by admin yet. */
const ATTENDANCE_TREND_FALLBACK_WEEKS = 8;

export async function getAttendanceTrend(
  supabase: SupabaseServerClient,
  termStartDate: string | null
): Promise<AttendanceWeekPoint[]> {
  let cutoffStr: string;
  if (termStartDate) {
    cutoffStr = termStartDate;
  } else {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - ATTENDANCE_TREND_FALLBACK_WEEKS * 7);
    cutoffStr = cutoff.toISOString().slice(0, 10);
  }

  const { data } = await supabase
    .from("attendance")
    .select("status, lessons!inner(lesson_date)")
    .gte("lessons.lesson_date", cutoffStr);

  const byWeek = new Map<string, { present: number; total: number }>();
  for (const row of data ?? []) {
    const lessonDate = row.lessons?.lesson_date;
    if (!lessonDate) continue;
    const date = new Date(lessonDate);
    // Bucket by the Monday of that week so a trend line reads sensibly.
    const dayOfWeek = date.getDay();
    const diffToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(date);
    monday.setDate(date.getDate() - diffToMonday);
    const weekKey = monday.toISOString().slice(0, 10);

    const bucket = byWeek.get(weekKey) ?? { present: 0, total: 0 };
    bucket.total += 1;
    if (row.status === "present" || row.status === "late") bucket.present += 1;
    byWeek.set(weekKey, bucket);
  }

  return [...byWeek.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekStart, { present, total }]) => ({
      label: `Week of ${new Date(weekStart).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
      ratePercent: total ? Math.round((present / total) * 100) : 0,
      totalMarked: total,
    }));
}

// ---------- Teacher workload ----------

export type TeacherWorkloadPoint = { teacherName: string; periodsPerWeek: number };

export async function getTeacherWorkload(
  supabase: SupabaseServerClient,
  academicYear: string,
  term: number
): Promise<TeacherWorkloadPoint[]> {
  const { data } = await supabase
    .from("timetable_entries")
    .select("teacher_id, teacher_profiles(profiles(full_name))")
    .eq("academic_year", academicYear)
    .eq("term", term);

  const byTeacher = new Map<string, { name: string; count: number }>();
  for (const row of data ?? []) {
    if (!row.teacher_id) continue;
    const name = row.teacher_profiles?.profiles?.full_name ?? "Unknown teacher";
    const entry = byTeacher.get(row.teacher_id) ?? { name, count: 0 };
    entry.count += 1;
    byTeacher.set(row.teacher_id, entry);
  }

  return [...byTeacher.values()]
    .map((e) => ({ teacherName: e.name, periodsPerWeek: e.count }))
    .sort((a, b) => b.periodsPerWeek - a.periodsPerWeek);
}

// ---------- Library overdue rate ----------

export type OverdueRatePoint = {
  label: string;
  ratePercent: number;
  overdueCount: number;
  activeCount: number;
};

/**
 * Capped so this stays a bounded per-day computation regardless of how
 * long the school has been using the library module — otherwise the
 * window (and the per-day loop cost) would grow forever.
 */
const OVERDUE_TREND_CAP_DAYS = 30;

export async function getLibraryOverdueTrend(
  supabase: SupabaseServerClient
): Promise<OverdueRatePoint[]> {
  const { data: loans } = await supabase
    .from("library_loans")
    .select("borrowed_at, due_at, returned_at");

  const points: OverdueRatePoint[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = OVERDUE_TREND_CAP_DAYS - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);

    let activeCount = 0;
    let overdueCount = 0;
    for (const loan of loans ?? []) {
      const borrowedAt = new Date(loan.borrowed_at);
      const returnedAt = loan.returned_at ? new Date(loan.returned_at) : null;
      const dueAt = new Date(loan.due_at);

      // Was this loan "on loan" as of this day? (Borrowed by end of day,
      // and not yet returned, or returned after this day.)
      const wasActive = borrowedAt <= day && (!returnedAt || returnedAt > day);
      if (!wasActive) continue;

      activeCount += 1;
      if (dueAt < day) overdueCount += 1;
    }

    points.push({
      label: day.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      ratePercent: activeCount ? Math.round((overdueCount / activeCount) * 100) : 0,
      overdueCount,
      activeCount,
    });
  }

  return points;
}
