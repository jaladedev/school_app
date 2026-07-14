import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scoreToLetterGrade, type GradeScaleEntry, type AttendanceStatus } from "@/types/database";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function rankDescending(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => b - a);
  return values.map((v) => sorted.indexOf(v) + 1);
}

export type SubjectResult = {
  subjectId: string;
  subjectName: string;
  scorePercent: number | null;
  letterGrade: string | null;
  position: string | null;
  classSize: number;
};

export type ReportCardData = {
  student: { id: string; fullName: string; admissionNo: string | null };
  className: string;
  term: number;
  academicYear: string;
  schoolName: string;
  schoolMotto: string | null;
  subjects: SubjectResult[];
  overall: {
    averagePercent: number | null;
    letterGrade: string | null;
    position: string | null;
    classSize: number;
  };
  attendance: { present: number; absent: number; late: number; excused: number; total: number };
  remark: { classTeacherRemark: string | null; adminRemark: string | null } | null;
};

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
  id: string;
  timetable_entry_id: string;
  timetable_entries: { term: number; academic_year: string } | null;
};

function computeSubjectPercent(
  studentId: string,
  assessmentIds: string[],
  maxScores: Map<string, number>,
  weights: Map<string, number | null>,
  grades: { assessment_id: string; student_id: string; score: number }[]
): number | null {
  const relevantGrades = assessmentIds
    .map((aid) => grades.find((g) => g.assessment_id === aid && g.student_id === studentId))
    .filter((g): g is NonNullable<typeof g> => !!g);

  if (!relevantGrades.length) return null;

  const allWeighted = assessmentIds.every((aid) => weights.get(aid) != null);

  if (allWeighted) {
    let total = 0;
    for (const g of relevantGrades) {
      const max = maxScores.get(g.assessment_id) ?? 0;
      const weight = weights.get(g.assessment_id) ?? 0;
      if (max > 0) total += (g.score / max) * weight;
    }
    return total;
  }

  let scoreSum = 0;
  let maxSum = 0;
  for (const g of relevantGrades) {
    scoreSum += g.score;
    maxSum += maxScores.get(g.assessment_id) ?? 0;
  }
  return maxSum > 0 ? (scoreSum / maxSum) * 100 : null;
}

export async function getReportCardData(
  studentId: string,
  term: number,
  academicYear: string
): Promise<ReportCardData | null> {
  const supabase = createClient();

  const admin = createAdminClient();

  const { data: settings } = await supabase
    .from("school_settings")
    .select("name, motto, grade_scale")
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

  const classmateIds = (classmates ?? []).map((c) => c.id);

  const { data: assessments } = await admin
    .from("assessments")
    .select("id, subject_id, max_score, weight_percent, subjects(name)")
    .eq("class_id", classId)
    .eq("term", term)
    .eq("academic_year", academicYear)
    .returns<AssessmentWithSubject[]>();

  const assessmentIds = (assessments ?? []).map((a) => a.id);

  // Only APPROVED grades count toward a report card — pending grades
  // (not yet moderated) shouldn't affect an official document or a
  // classmate's ranking.
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

  for (const [subjectId, info] of subjectMap.entries()) {
    const percentByStudent = new Map<string, number>();

    for (const sid of classmateIds) {
      const percent = computeSubjectPercent(
        sid,
        info.assessmentIds,
        info.maxScores,
        info.weights,
        allGrades ?? []
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

  const { data: lessons } = await admin
    .from("lessons")
    .select("id, timetable_entry_id, timetable_entries(term, academic_year)")
    .eq("class_id", classId)
    .returns<LessonWithTimetableEntry[]>();

  const relevantLessonIds = (lessons ?? [])
    .filter(
      (l) =>
        l.timetable_entries?.term === term && l.timetable_entries?.academic_year === academicYear
    )
    .map((l) => l.id);

  const { data: attendanceRows } = relevantLessonIds.length
    ? await admin
        .from("attendance")
        .select("status")
        .eq("student_id", studentId)
        .in("lesson_id", relevantLessonIds)
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
    .select("class_teacher_remark, admin_remark")
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
      ? { classTeacherRemark: remark.class_teacher_remark, adminRemark: remark.admin_remark }
      : null,
  };
}