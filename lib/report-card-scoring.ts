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
  // Competition ranking (ties share a rank; the next distinct value skips
  // ahead by the tie count, e.g. 90,80,80,70 -> 1,2,2,4). Previously this
  // sorted once (O(n log n)) but then called sorted.indexOf(v) for every
  // value (O(n) each), making the whole function O(n^2) -- fine for a
  // class of 30-40, but the same shape is used for whole-class ranking
  // and doesn't need to be quadratic. Sorting index/value pairs once and
  // walking the sorted order in a single pass keeps the same tie
  // semantics at O(n log n).
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => b.v - a.v);

  const ranks = new Array<number>(values.length);
  let rank = 0;
  indexed.forEach(({ v, i }, pos) => {
    if (pos === 0 || v !== indexed[pos - 1].v) rank = pos + 1;
    ranks[i] = rank;
  });
  return ranks;
}

/** Key used to look up a grade by (assessment, student) in O(1). */
function gradeKey(assessmentId: string, studentId: string): string {
  return `${assessmentId}::${studentId}`;
}

type Grade = { assessment_id: string; student_id: string; score: number };

/**
 * Indexes a flat grades array into an O(1)-lookup Map, keyed by
 * assessment+student. Build this once per report-card/class-ranking run
 * and reuse it across every computeSubjectPercent call, rather than
 * passing the raw array in and re-scanning it per call (see
 * computeSubjectPercent below).
 */
export function indexGradesByAssessmentAndStudent(grades: Grade[]): Map<string, Grade> {
  const map = new Map<string, Grade>();
  for (const g of grades) {
    map.set(gradeKey(g.assessment_id, g.student_id), g);
  }
  return map;
}

export function computeSubjectPercent(
  studentId: string,
  assessmentIds: string[],
  maxScores: Map<string, number>,
  weights: Map<string, number | null>,
  gradesByKey: Map<string, Grade>
): number | null {
  const relevantGrades = assessmentIds
    .map((aid) => gradesByKey.get(gradeKey(aid, studentId)))
    .filter((g): g is Grade => !!g);

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
  remark: {
    classTeacherRemark: string | null;
    adminRemark: string | null;
    moderationStatus: "pending" | "approved";
  } | null;
};
