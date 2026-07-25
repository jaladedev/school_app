"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertRole } from "@/lib/actions/authGuards";

export async function issueTestimonial(input: {
  studentId: string;
  conductRemark: string;
  leavingAcademicYear: string;
}) {
  const { id: actorId } = await assertRole(["admin"], "Only an admin can issue a testimonial.");
  if (!input.conductRemark.trim()) throw new Error("A conduct remark is required.");
  if (!input.leavingAcademicYear.trim()) throw new Error("The leaving session is required.");

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("testimonials")
    .select("id")
    .eq("student_id", input.studentId)
    .maybeSingle();
  if (existing) {
    throw new Error("A testimonial has already been issued for this student.");
  }

  const { data: earliestEnrollment } = await admin
    .from("enrollments")
    .select("academic_year")
    .eq("student_id", input.studentId)
    .order("academic_year", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { error } = await admin.from("testimonials").insert({
    student_id: input.studentId,
    conduct_remark: input.conductRemark.trim(),
    admission_academic_year: earliestEnrollment?.academic_year ?? input.leavingAcademicYear,
    leaving_academic_year: input.leavingAcademicYear.trim(),
    issued_by: actorId,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/admin/students/${input.studentId}/testimonial`);
}
