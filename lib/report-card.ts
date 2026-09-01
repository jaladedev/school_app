import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertRole } from "@/lib/actions/authGuards";
import { scoreToLetterGrade, type GradeScaleEntry, type AttendanceStatus } from "@/types/database";
import {
  ordinal,
  rankDescending,
  computeSubjectPercent,
  indexGradesByAssessmentAndStudent,
  type SubjectResult,
  type ReportCardData,
} from "@/lib/report-card-scoring";

export { ordinal, rankDescending, computeSubjectPercent };
export type { SubjectResult, ReportCardData };

type StudentProfileWithProfile = {
  id: string;
  admission_no: string | null;
  class_id: string | null;
  profiles: { full_name: string } | null;
};

type AssessmentWithSubject = {
  id: string;
  subject_id: string;
  max_score: number;
  weight_percent: number | null;
  subjects: { name: string } | null;
};

type LessonWithTimetableEntry = {
  lesson_date: string;
  timetable_entries: { term: number; academic_year: string } | null;
};

export async function getReportCardData(
  studentId: string,
  term: number,
  academicYear: string
): Promise<ReportCardData | null> {
  // "Not signed in at all" still throws -- that's a real auth failure the
  // caller can't do anything about, and every current call site is inside
  // a role-gated layout anyway, so it's effectively unreachable in
  // practice.
  const requester = await assertRole(
    ["admin", "teacher", "parent", "student"],
    "You must be signed in to view a report card."
  );

  // "Signed in, but not entitled to THIS student's report card" is a
  // different kind of failure: every current caller happens to only ever
  // pass a studentId the requester is already entitled to (parent/report-
  // card's studentId comes from resolveSelectedChild, which is pre-
  // filtered to the parent's own linked children; student/report-card
  // always passes the requester's own id), so this branch is dead code
  // today. It's still worth having, though, as a guard for any future
  // caller that doesn't pre-filter -- and it returns null (this
  // function's existing "nothing to show" signal, same as "no class
  // assigned") rather than throwing, so an unauthorized studentId renders
  // the same friendly empty state every page here already has for the
  // null case, instead of surfacing a generic uncaught-error page. It
  // also avoids confirming/denying whether a report card exists for that
  // id, which a distinct "forbidden" message would leak.
  if (requester.id !== studentId && requester.role !== "admin" && requester.role !== "teacher") {
    if (requester.role !== "parent") {
      return null;
    }

    const { data: link } = await createAdminClient()
      .from("guardian_links")
      .select("id")
      .eq("parent_id", requester.id)
      .eq("student_id", studentId)
      .maybeSingle();

    if (!link) {
      return null;
    }
  }

  const supabase = createClient();
  const admin = createAdminClient();

  const { data: settings } = await supabase
    .from("school_settings")
    .select("name, motto, logo_url, grade_scale")
    .eq("id", 1)
    .single();

  const gradeScale: GradeScaleEntry[] = settings?.grade_scale ?? [];

  const { data: studentProfile } = await admin
    .from("student_profiles")
    .select("id, admission_no, class_id, profiles(full_name)")
    .eq("id", studentId)
    .single()
    .returns<StudentProfileWithProfile>();

  if (!studentProfile || !studentProfile.class_id) return null;

  const classId = studentProfile.class_id;

  const { data: classRow } = await admin
    .from("classes")
    .select("name, arm")
    .eq("id", classId)
    .single();

  const { data: classmates } = await admin
    .from("student_profiles")
    .select("id")
    .eq("class_id", classId);

  const classmateIds = (classmates ?? []).map((c: { id: string }) => c.id);

  const { data: assessments } = await admin
    .from("assessments")
    .select("id, subject_id, max_score, weight_percent, subjects(name)")
    .eq("class_id", classId)
    .eq("term", term)
    .eq("academic_year", academicYear)
    .returns<AssessmentWithSubject[]>();

  const assessmentIds = (assessments ?? []).map((a: { id: string }) => a.id);

  const { data: allGrades } = assessmentIds.length
    ? await admin
        .from("grades")
        .select("assessment_id, student_id, score")
        .in("assessment_id", assessmentIds)
        .eq("moderation_status", "approved")
    : { data: [] };

  const subjectMap = new Map<
    string,
    {
      name: string;
      assessmentIds: string[];
      maxScores: Map<string, number>;
      weights: Map<string, number | null>;
    }
  >();

  for (const a of assessments ?? []) {
    const subjectName = a.subjects?.name ?? "Unknown";
    if (!subjectMap.has(a.subject_id)) {
      subjectMap.set(a.subject_id, {
        name: subjectName,
        assessmentIds: [],
        maxScores: new Map(),
        weights: new Map(),
      });
    }
    const entry = subjectMap.get(a.subject_id)!;
    entry.assessmentIds.push(a.id);
    entry.maxScores.set(a.id, a.max_score);
    entry.weights.set(a.id, a.weight_percent);
  }

  const subjects: SubjectResult[] = [];
  const overallPercentByStudent = new Map<string, { sum: number; count: number }>();

  // Indexed once up front (O(totalGrades)) instead of re-scanning the
  // whole class's grades array inside computeSubjectPercent for every
  // (subject, student) pair -- with C subjects and S students that scan
  // was happening C*S times, i.e. O(subjects * students * totalGrades).
  const gradesByKey = indexGradesByAssessmentAndStudent(allGrades ?? []);

  for (const [subjectId, info] of subjectMap.entries()) {
    const percentByStudent = new Map<string, number>();

    for (const sid of classmateIds) {
      const percent = computeSubjectPercent(
        sid,
        info.assessmentIds,
        info.maxScores,
        info.weights,
        gradesByKey
      );
      if (percent !== null) {
        percentByStudent.set(sid, percent);
        const overall = overallPercentByStudent.get(sid) ?? { sum: 0, count: 0 };
        overall.sum += percent;
        overall.count += 1;
        overallPercentByStudent.set(sid, overall);
      }
    }

    const rankedIds = [...percentByStudent.keys()];
    const rankedValues = rankedIds.map((id) => percentByStudent.get(id)!);
    const ranks = rankDescending(rankedValues);

    const targetIndex = rankedIds.indexOf(studentId);
    const targetPercent = targetIndex >= 0 ? rankedValues[targetIndex] : null;
    const targetRank = targetIndex >= 0 ? ranks[targetIndex] : null;

    subjects.push({
      subjectId,
      subjectName: info.name,
      scorePercent: targetPercent !== null ? Math.round(targetPercent * 10) / 10 : null,
      letterGrade:
        targetPercent !== null && gradeScale.length
          ? scoreToLetterGrade(targetPercent, gradeScale)
          : null,
      position: targetRank !== null ? ordinal(targetRank) : null,
      classSize: rankedIds.length,
    });
  }

  subjects.sort((a, b) => a.subjectName.localeCompare(b.subjectName));

  const overallIds = [...overallPercentByStudent.keys()];
  const overallAverages = overallIds.map((id) => {
    const { sum, count } = overallPercentByStudent.get(id)!;
    return count > 0 ? sum / count : 0;
  });
  const overallRanks = rankDescending(overallAverages);

  const overallIndex = overallIds.indexOf(studentId);
  const overallAverage = overallIndex >= 0 ? overallAverages[overallIndex] : null;
  const overallRank = overallIndex >= 0 ? overallRanks[overallIndex] : null;

  // Attendance is now one record per class per day (not per lesson), so
  // there's no lesson_id to filter by. Term boundaries aren't tracked as an
  // explicit date range anywhere, so derive them from this class's lesson
  // dates for the term/academic year, then filter attendance by that range.
  const { data: lessons } = await admin
    .from("lessons")
    .select("lesson_date, timetable_entries(term, academic_year)")
    .eq("class_id", classId)
    .returns<LessonWithTimetableEntry[]>();

  const termLessonDates = (lessons ?? [])
    .filter(
      (l: LessonWithTimetableEntry) =>
        l.timetable_entries?.term === term && l.timetable_entries?.academic_year === academicYear
    )
    .map((l: LessonWithTimetableEntry) => l.lesson_date)
    .sort();

  const termStart = termLessonDates[0];
  const termEnd = termLessonDates[termLessonDates.length - 1];

  const { data: attendanceRows } = termStart
    ? await admin
        .from("attendance")
        .select("status")
        .eq("student_id", studentId)
        .eq("class_id", classId)
        .gte("date", termStart)
        .lte("date", termEnd)
    : { data: [] };

  const attendance: Record<AttendanceStatus, number> & { total: number } = {
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    total: 0,
  };
  for (const row of attendanceRows ?? []) {
    const status = row.status as AttendanceStatus;
    attendance[status] += 1;
    attendance.total += 1;
  }

  const { data: remark } = await admin
    .from("report_card_remarks")
    .select("class_teacher_remark, admin_remark, moderation_status")
    .eq("student_id", studentId)
    .eq("term", term)
    .eq("academic_year", academicYear)
    .maybeSingle();

  return {
    student: {
      id: studentId,
      fullName: studentProfile.profiles?.full_name ?? "Unknown",
      admissionNo: studentProfile.admission_no,
    },
    className: `${classRow?.name ?? ""} ${classRow?.arm ?? ""}`.trim(),
    term,
    academicYear,
    schoolName: settings?.name ?? "School Name",
    schoolMotto: settings?.motto ?? null,
    schoolLogoUrl: settings?.logo_url ?? null,
    subjects,
    overall: {
      averagePercent: overallAverage !== null ? Math.round(overallAverage * 10) / 10 : null,
      letterGrade:
        overallAverage !== null && gradeScale.length
          ? scoreToLetterGrade(overallAverage, gradeScale)
          : null,
      position: overallRank !== null ? ordinal(overallRank) : null,
      classSize: overallIds.length,
    },
    attendance,
    remark: remark
      ? {
          classTeacherRemark: remark.class_teacher_remark,
          adminRemark: remark.admin_remark,
          moderationStatus: remark.moderation_status as "pending" | "approved",
        }
      : null,
  };
}

export function isFutureTerm(
  term: number,
  academicYear: string,
  currentTerm: number,
  currentAcademicYear: string
): boolean {
  if (academicYear > currentAcademicYear) return true;
  if (academicYear < currentAcademicYear) return false;
  return term > currentTerm;
}
