import { createClient } from "@/lib/supabase/server";
import type { AttendanceStatus } from "@/types/database";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

// Standard "competition ranking": tied scores share the same position,
// and the next distinct score skips ahead accordingly (1, 1, 3, 4...).
function rankDescending(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => b - a);
  return values.map((v) => sorted.indexOf(v) + 1);
}

export type SubjectResult = {
  subjectId: string;
  subjectName: string;
  scorePercent: number | null;
  position: string | null;
  classSize: number;
};

export type ReportCardData = {
  student: { id: string; fullName: string; admissionNo: string | null };
  className: string;
  term: number;
  academicYear: string;
  subjects: SubjectResult[];
  overall: { averagePercent: number | null; position: string | null; classSize: number };
  attendance: { present: number; absent: number; late: number; excused: number; total: number };
  remark: { classTeacherRemark: string | null; adminRemark: string | null } | null;
};

export async function getReportCardData(
  studentId: string,
  term: number,
  academicYear: string
): Promise<ReportCardData | null> {
  const supabase = createClient();

  const { data: studentProfile } = await supabase
    .from("student_profiles")
    .select("id, admission_no, class_id, profiles(full_name)")
    .eq("id", studentId)
    .single();

  if (!studentProfile || !studentProfile.class_id) return null;

  const classId = studentProfile.class_id;

  const { data: classRow } = await supabase
    .from("classes")
    .select("name, arm")
    .eq("id", classId)
    .single();

  // Everyone in the class — needed to compute rank, not just the target student.
  const { data: classmates } = await supabase
    .from("student_profiles")
    .select("id")
    .eq("class_id", classId);

  const classmateIds = (classmates ?? []).map((c) => c.id);

  const { data: assessments } = await supabase
    .from("assessments")
    .select("id, subject_id, max_score, subjects(name)")
    .eq("class_id", classId)
    .eq("term", term)
    .eq("academic_year", academicYear);

  const assessmentIds = (assessments ?? []).map((a) => a.id);

  const { data: allGrades } = assessmentIds.length
    ? await supabase
        .from("grades")
        .select("assessment_id, student_id, score")
        .in("assessment_id", assessmentIds)
    : { data: [] };

  // Group assessments by subject.
  const subjectMap = new Map<string, { name: string; assessmentIds: string[]; maxScores: Map<string, number> }>();
  for (const a of assessments ?? []) {
    const subjectName = (a as any).subjects?.name ?? "Unknown";
    if (!subjectMap.has(a.subject_id)) {
      subjectMap.set(a.subject_id, { name: subjectName, assessmentIds: [], maxScores: new Map() });
    }
    const entry = subjectMap.get(a.subject_id)!;
    entry.assessmentIds.push(a.id);
    entry.maxScores.set(a.id, a.max_score);
  }

  // For each subject, compute every classmate's percentage:
  // sum(score) / sum(max_score) * 100 across that subject's assessments.
  const subjects: SubjectResult[] = [];
  const overallPercentByStudent = new Map<string, { sum: number; count: number }>();

  for (const [subjectId, info] of subjectMap.entries()) {
    const percentByStudent = new Map<string, number>();

    for (const sid of classmateIds) {
      let scoreSum = 0;
      let maxSum = 0;
      for (const aid of info.assessmentIds) {
        const grade = (allGrades ?? []).find((g) => g.assessment_id === aid && g.student_id === sid);
        if (grade) {
          scoreSum += grade.score;
          maxSum += info.maxScores.get(aid) ?? 0;
        }
      }
      if (maxSum > 0) {
        const percent = (scoreSum / maxSum) * 100;
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
      position: targetRank !== null ? ordinal(targetRank) : null,
      classSize: rankedIds.length,
    });
  }

  subjects.sort((a, b) => a.subjectName.localeCompare(b.subjectName));

  // Overall average + position, based on each student's average percent
  // across all subjects they have any grade in.
  const overallIds = [...overallPercentByStudent.keys()];
  const overallAverages = overallIds.map((id) => {
    const { sum, count } = overallPercentByStudent.get(id)!;
    return count > 0 ? sum / count : 0;
  });
  const overallRanks = rankDescending(overallAverages);

  const overallIndex = overallIds.indexOf(studentId);
  const overallAverage = overallIndex >= 0 ? overallAverages[overallIndex] : null;
  const overallRank = overallIndex >= 0 ? overallRanks[overallIndex] : null;

  // Attendance: lessons for this class whose timetable entry matches the
  // requested term/academic year (lessons without a linked timetable
  // entry are excluded — no reliable term to attribute them to).
  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, timetable_entry_id, timetable_entries(term, academic_year)")
    .eq("class_id", classId);

  const relevantLessonIds = (lessons ?? [])
    .filter((l: any) => l.timetable_entries?.term === term && l.timetable_entries?.academic_year === academicYear)
    .map((l) => l.id);

  const { data: attendanceRows } = relevantLessonIds.length
    ? await supabase
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

  const { data: remark } = await supabase
    .from("report_card_remarks")
    .select("class_teacher_remark, admin_remark")
    .eq("student_id", studentId)
    .eq("term", term)
    .eq("academic_year", academicYear)
    .maybeSingle();

  return {
    student: {
      id: studentId,
      fullName: (studentProfile as any).profiles?.full_name ?? "Unknown",
      admissionNo: studentProfile.admission_no,
    },
    className: `${classRow?.name ?? ""} ${classRow?.arm ?? ""}`.trim(),
    term,
    academicYear,
    subjects,
    overall: {
      averagePercent: overallAverage !== null ? Math.round(overallAverage * 10) / 10 : null,
      position: overallRank !== null ? ordinal(overallRank) : null,
      classSize: overallIds.length,
    },
    attendance,
    remark: remark
      ? { classTeacherRemark: remark.class_teacher_remark, adminRemark: remark.admin_remark }
      : null,
  };
}