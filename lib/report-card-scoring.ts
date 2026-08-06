// Pure scoring/ranking helpers for report cards — deliberately has NO
// imports from lib/supabase/*, so it can be unit-tested and imported
// anywhere (including edge runtimes or future client-side code) without
// pulling in Supabase/Paystack env validation. getReportCardData in
// report-card.ts is the only place that talks to the database; keep it
// that way rather than adding data-fetching imports back into this file.

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export function rankDescending(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => b - a);
  return values.map((v) => sorted.indexOf(v) + 1);
}

export function computeSubjectPercent(
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

  const hasAllGrades = assessmentIds.every((aid) =>
    relevantGrades.some((g) => g.assessment_id === aid)
  );
  if (!hasAllGrades) return null;

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
  schoolLogoUrl: string | null;
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
