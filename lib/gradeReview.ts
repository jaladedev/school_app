import { createClient } from "@/lib/supabase/server";
import type { GradeModerationStatus } from "@/types/database";

export type ReviewRow = {
  gradeId: string;
  studentName: string;
  admissionNo: string | null;
  score: number;
  remark: string | null;
  status: GradeModerationStatus;
  reviewNote: string | null;
};

export type GradeReview = {
  assessment: {
    id: string;
    title: string;
    maxScore: number;
    term: number;
    academicYear: string;
    className: string;
    subjectName: string;
  };
  rows: ReviewRow[];
};

/**
 * Loads one assessment and its grades for HOD/admin review. Everything is
 * read with the signed-in user's client, so RLS decides who gets anything
 * back (HODs and admins see every grade; anyone else gets null/empty).
 * Student names are readable the same way: staff and admins have SELECT on
 * student_profiles and profiles.
 */
export async function loadGradeReview(assessmentId: string): Promise<GradeReview | null> {
  const supabase = createClient();

  const { data: assessment } = await supabase
    .from("assessments")
    .select("id, title, max_score, term, academic_year, classes(name, arm), subjects(name)")
    .eq("id", assessmentId)
    .maybeSingle();
  if (!assessment) return null;

  const { data: grades } = await supabase
    .from("grades")
    .select("id, student_id, score, remark, moderation_status, review_note")
    .eq("assessment_id", assessmentId);

  const studentIds = (grades ?? []).map((g) => g.student_id);
  const { data: students } = studentIds.length
    ? await supabase
        .from("student_profiles")
        .select("id, admission_no, profiles(full_name)")
        .in("id", studentIds)
    : { data: [] };
  const studentById = new Map((students ?? []).map((s) => [s.id, s]));

  const rows: ReviewRow[] = (grades ?? [])
    .map((g) => {
      const student = studentById.get(g.student_id);
      return {
        gradeId: g.id,
        studentName: student?.profiles?.full_name ?? "Unknown student",
        admissionNo: student?.admission_no ?? null,
        score: g.score,
        remark: g.remark,
        status: g.moderation_status,
        reviewNote: g.review_note,
      };
    })
    .sort((a, b) => a.studentName.localeCompare(b.studentName));

  return {
    assessment: {
      id: assessment.id,
      title: assessment.title,
      maxScore: assessment.max_score,
      term: assessment.term,
      academicYear: assessment.academic_year,
      className: `${assessment.classes?.name ?? ""} ${assessment.classes?.arm ?? ""}`.trim(),
      subjectName: assessment.subjects?.name ?? "",
    },
    rows,
  };
}
