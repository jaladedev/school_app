import { createClient } from "@/lib/supabase/server";
import { IssueTestimonialForm } from "@/components/IssueTestimonialForm";
import { TestimonialView } from "@/components/TestimonialView";

export default async function TestimonialPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const supabase = createClient();

  const { data: settings } = await supabase
    .from("school_settings")
    .select("name, motto, logo_url, address, current_academic_year")
    .eq("id", 1)
    .single();

  const { data: student } = await supabase
    .from("student_profiles")
    .select("admission_no, profiles(full_name), classes(name, arm, education_level, level_number)")
    .eq("id", studentId)
    .single();

  const { data: testimonial } = await supabase
    .from("testimonials")
    .select("*")
    .eq("student_id", studentId)
    .maybeSingle();

  if (!student) {
    return (
      <div className="max-w-lg">
        <p className="text-sm text-clay">Student not found.</p>
      </div>
    );
  }

  if (!testimonial) {
    return (
      <div className="max-w-lg">
        <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Issue Testimonial</h1>
        <p className="mb-6 text-sm text-ink-soft">
          For {student.profiles?.full_name ?? "this student"}.
        </p>
        <IssueTestimonialForm
          studentId={studentId}
          defaultLeavingYear={settings?.current_academic_year ?? ""}
        />
      </div>
    );
  }

  return (
    <TestimonialView
      schoolName={settings?.name ?? "School Name"}
      schoolMotto={settings?.motto ?? null}
      schoolAddress={settings?.address ?? null}
      logoUrl={settings?.logo_url ?? null}
      studentName={student.profiles?.full_name ?? "Unknown"}
      admissionNo={student.admission_no ?? null}
      admissionAcademicYear={testimonial.admission_academic_year}
      leavingAcademicYear={testimonial.leaving_academic_year}
      finalClassLabel={
        student.classes ? `${student.classes.name} ${student.classes.arm ?? ""}`.trim() : null
      }
      conductRemark={testimonial.conduct_remark}
      issuedAt={testimonial.issued_at}
    />
  );
}
