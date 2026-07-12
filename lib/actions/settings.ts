"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import type { GradeScaleEntry } from "@/types/database";

export async function saveSchoolSettings(input: {
  name: string;
  motto?: string;
  address?: string;
  currentAcademicYear: string;
  currentTerm: number;
  gradeScale: GradeScaleEntry[];
}) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    throw new Error("Only an admin can update school settings.");
  }

  const supabase = createClient();

  const { error } = await supabase
    .from("school_settings")
    .update({
      name: input.name,
      motto: input.motto || null,
      address: input.address || null,
      current_academic_year: input.currentAcademicYear,
      current_term: input.currentTerm,
      grade_scale: input.gradeScale,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin/settings");
}