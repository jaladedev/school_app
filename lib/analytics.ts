import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = ReturnType<typeof createClient>;

// ---------- Enrollment trend ----------

export type EnrollmentTrendPoint = { label: string; count: number };

export async function getEnrollmentTrend(
  supabase: SupabaseServerClient
): Promise<EnrollmentTrendPoint[]> {
  const { data } = await supabase.from("enrollments").select("academic_year, term");

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const key = `${row.academic_year} · Term ${row.term}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => a.label.localeCompare(b.label));
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
    .select("academic_year, term, total_amount_kobo, discount_kobo, amount_paid_kobo, status");

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

  return [...byTerm.values()].sort((a, b) => a.label.localeCompare(b.label));
}

// ---------- Average grades by subject ----------

export type SubjectGradeAverage = {
  subjectName: string;
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
    .select("id, subject_id, max_score, subjects(name)")
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
  const bySubject = new Map<string, { name: string; totalPercent: number; count: number }>();

  for (const g of grades ?? []) {
    const assessment = assessmentById.get(g.assessment_id);
    if (!assessment || !assessment.max_score) continue;
    const subjectName = assessment.subjects?.name ?? "Unknown subject";
    const percent = (g.score / assessment.max_score) * 100;
    const entry = bySubject.get(assessment.subject_id) ?? {
      name: subjectName,
      totalPercent: 0,
      count: 0,
    };
    entry.totalPercent += percent;
    entry.count += 1;
    bySubject.set(assessment.subject_id, entry);
  }

  return [...bySubject.values()]
    .map((e) => ({
      subjectName: e.name,
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
