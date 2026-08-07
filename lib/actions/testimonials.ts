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

  const leavingAcademicYear = input.leavingAcademicYear.trim();
  if (!leavingAcademicYear) throw new Error("The leaving session is required.");
  // admission_academic_year below is always sourced from enrollments.academic_year
  // -- a consistently formatted, system-generated value. leaving_academic_year
  // was free-typed with only a placeholder hint ("e.g. 2025/2026") and no
  // actual validation, so "2025", "25/26", or "2025-2026" could end up
  // printed right next to the canonically formatted admission year on the
  // same testimonial. Enforce the same YYYY/YYYY shape, with the second
  // year one more than the first (a real academic year, not just two
  // arbitrary years).
  const match = leavingAcademicYear.match(/^(\d{4})\/(\d{4})$/);
  if (!match || Number(match[2]) !== Number(match[1]) + 1) {
    throw new Error('The leaving session must be in the form "2025/2026".');
  }

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
    admission_academic_year: earliestEnrollment?.academic_year ?? leavingAcademicYear,
    leaving_academic_year: leavingAcademicYear,
    issued_by: actorId,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/admin/students/${input.studentId}/testimonial`);
}
