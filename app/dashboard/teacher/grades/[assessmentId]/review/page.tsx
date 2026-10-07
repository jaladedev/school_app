import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/server";
import { loadGradeReview } from "@/lib/gradeReview";
import { GradeReviewPanel } from "@/components/GradeReviewPanel";
import { EmptyState } from "@/components/EmptyState";

export default async function HodGradeReviewPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = createClient();
  const { data: teacher } = await supabase
    .from("teacher_profiles")
    .select("staff_role")
    .eq("id", profile.id)
    .maybeSingle();
  if (teacher?.staff_role !== "hod") redirect("/dashboard/teacher/grades");

  const review = await loadGradeReview(assessmentId);

  return (
    <div className="max-w-2xl">
      <Link
        href="/dashboard/teacher/grades"
        className="mb-2 inline-block text-sm text-leaf hover:underline"
      >
        ← Grades
      </Link>
      {review ? (
        <>
          <p className="mb-1 text-xs uppercase tracking-wide text-leaf">
            {review.assessment.subjectName} · {review.assessment.className} · Term{" "}
            {review.assessment.term}
          </p>
          <h1 className="mb-6 font-display text-2xl font-semibold text-ink">
            {review.assessment.title}{" "}
            <span className="text-base font-normal text-ink-soft">
              / {review.assessment.maxScore}
            </span>
          </h1>
          {review.rows.length ? (
            <GradeReviewPanel
              assessmentId={assessmentId}
              maxScore={review.assessment.maxScore}
              rows={review.rows}
            />
          ) : (
            <EmptyState message="No grades have been entered for this assessment yet." />
          )}
        </>
      ) : (
        <EmptyState message="This assessment couldn't be found." />
      )}
    </div>
  );
}
