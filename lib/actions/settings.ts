"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertRole } from "@/lib/actions/authGuards";
import type { GradeScaleEntry } from "@/types/database";

const ACADEMIC_YEAR_RE = /^\d{4}\/\d{4}$/;
const VALID_TERMS = [1, 2, 3] as const;

export async function saveSchoolSettings(input: {
  name: string;
  motto?: string;
  address?: string;
  logoUrl?: string;
  currentAcademicYear: string;
  currentTerm: number;
  currentTermStartDate?: string | null;
  libraryFineKoboPerDay?: number;
  gradeScale: GradeScaleEntry[];
}) {
  await assertRole(["admin"], "Only an admin can update school settings.");

  // ── Basic field validation ──────────────────────────────────────────
  if (!input.name.trim()) throw new Error("School name is required.");

  if (!ACADEMIC_YEAR_RE.test(input.currentAcademicYear)) {
    throw new Error("Academic year must be in YYYY/YYYY format (e.g. 2025/2026).");
  }
  const [startYear, endYear] = input.currentAcademicYear.split("/").map(Number);
  if (endYear !== startYear + 1) {
    throw new Error("Academic year must span exactly one year (e.g. 2025/2026).");
  }

  if (!VALID_TERMS.includes(input.currentTerm as (typeof VALID_TERMS)[number])) {
    throw new Error("Term must be 1, 2, or 3.");
  }

  if (
    input.libraryFineKoboPerDay !== undefined &&
    (!Number.isInteger(input.libraryFineKoboPerDay) || input.libraryFineKoboPerDay < 0)
  ) {
    throw new Error("Library fine must be a non-negative whole number of kobo.");
  }

  // ── Grade scale validation ──────────────────────────────────────────
  if (!input.gradeScale.length) {
    throw new Error("Grade scale must have at least one entry.");
  }
  for (const [i, entry] of input.gradeScale.entries()) {
    if (!entry.grade.trim()) {
      throw new Error(`Grade entry ${i + 1} needs a label.`);
    }
    if (!Number.isFinite(entry.min) || entry.min < 0 || entry.min > 100) {
      throw new Error(`Grade entry "${entry.grade}" minimum must be between 0 and 100.`);
    }
  }
  // Entries must be sorted highest-min first so the lookup works correctly
  for (let i = 1; i < input.gradeScale.length; i++) {
    if (input.gradeScale[i].min >= input.gradeScale[i - 1].min) {
      throw new Error("Grade scale entries must be ordered from highest to lowest minimum score.");
    }
  }

  const supabase = createClient();

  const { error } = await supabase
    .from("school_settings")
    .update({
      name: input.name.trim(),
      motto: input.motto?.trim() || null,
      address: input.address?.trim() || null,
      logo_url: input.logoUrl || null,
      current_academic_year: input.currentAcademicYear,
      current_term: input.currentTerm,
      current_term_start_date: input.currentTermStartDate || null,
      library_fine_kobo_per_day: input.libraryFineKoboPerDay ?? 0,
      grade_scale: input.gradeScale,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin/settings");
}
