"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertRole } from "@/lib/actions/authGuards";
import type { GradeScaleEntry } from "@/types/database";

export async function saveSchoolSettings(input: {
  name: string;
  motto?: string;
  address?: string;
  logoUrl?: string;
  currentAcademicYear: string;
  currentTerm: number;
  currentTermStartDate?: string | null;
  gradeScale: GradeScaleEntry[];
}) {
  await assertRole(["admin"], "Only an admin can update school settings.");

  const supabase = createClient();

  const { error } = await supabase
    .from("school_settings")
    .update({
      name: input.name,
      motto: input.motto || null,
      address: input.address || null,
      logo_url: input.logoUrl || null,
      current_academic_year: input.currentAcademicYear,
      current_term: input.currentTerm,
      current_term_start_date: input.currentTermStartDate || null,
      grade_scale: input.gradeScale,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin/settings");
}
