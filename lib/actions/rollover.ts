"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertRole } from "@/lib/actions/authGuards";
import { writeAuditLog } from "@/lib/audit";
import { promoteStudents, type PromotionOutcome } from "@/lib/actions/admin";
import type { EducationLevel } from "@/types/database";

// Mirrors valid_level_number() in the DB and LEVEL_OPTIONS in
// CreateClassForm.tsx -- keep all three in sync if the level structure
// ever changes.
const LEVEL_MAX: Record<EducationLevel, number> = { primary: 6, jss: 3, sss: 3 };
const STAGE_LABEL: Record<EducationLevel, string> = { primary: "Primary", jss: "JSS", sss: "SS" };

export type NextLevel = { educationLevel: EducationLevel; levelNumber: number } | null;

/**
 * The standard promotion path: primary1-5 -> primary+1, primary6 -> jss1,
 * jss1-2 -> jss+1, jss3 -> sss1, sss1-2 -> sss+1, sss3 -> null (graduates,
 * there's nowhere further to promote to).
 */
export function nextLevelFor(educationLevel: EducationLevel, levelNumber: number): NextLevel {
  if (levelNumber < LEVEL_MAX[educationLevel]) {
    return { educationLevel, levelNumber: levelNumber + 1 };
  }
  if (educationLevel === "primary") return { educationLevel: "jss", levelNumber: 1 };
  if (educationLevel === "jss") return { educationLevel: "sss", levelNumber: 1 };
  return null; // sss3 -> graduate
}

/** "2025/2026" -> "2026/2027". Falls back to null if the format doesn't match, so the wizard just leaves the field blank for the admin to fill in rather than guessing wrong. */
export function suggestNextAcademicYear(current: string): string | null {
  const match = /^(\d{4})\/(\d{4})$/.exec(current.trim());
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (end !== start + 1) return null;
  return `${start + 1}/${end + 1}`;
}

export type RolloverClassPreview = {
  id: string;
  name: string;
  arm: string | null;
  educationLevel: EducationLevel;
  levelNumber: number;
  academicYear: string;
  studentCount: number;
  nextLevel: NextLevel;
  /** An existing class already matching the computed next level + arm for nextAcademicYear, if one exists (e.g. a rerun after a partial rollover, or an admin who pre-created it). */
  existingTargetClassId: string | null;
};

export type RolloverPreview = {
  currentAcademicYear: string;
  currentTerm: number;
  currentTermStartDate: string | null;
  suggestedNextAcademicYear: string | null;
  classes: RolloverClassPreview[];
};

export async function getRolloverPreview(): Promise<RolloverPreview> {
  await assertRole(["admin"], "Only an admin can view the academic year rollover wizard.");
  const admin = createAdminClient();

  const { data: settings } = await admin
    .from("school_settings")
    .select("current_academic_year, current_term, current_term_start_date")
    .eq("id", 1)
    .single();

  const currentAcademicYear = settings?.current_academic_year ?? "";
  const currentTerm = settings?.current_term ?? 1;
  const currentTermStartDate = settings?.current_term_start_date ?? null;
  const suggestedNextAcademicYear = currentAcademicYear
    ? suggestNextAcademicYear(currentAcademicYear)
    : null;

  const { data: classes } = await admin
    .from("classes")
    .select("id, name, arm, education_level, level_number, academic_year")
    .eq("is_archived", false)
    .order("education_level", { ascending: true })
    .order("level_number", { ascending: true })
    .order("arm", { ascending: true });

  const { data: studentRows } = await admin.from("student_profiles").select("class_id");
  const countByClass = new Map<string, number>();
  for (const row of studentRows ?? []) {
    if (!row.class_id) continue;
    countByClass.set(row.class_id, (countByClass.get(row.class_id) ?? 0) + 1);
  }

  // If there's a candidate next academic year, look for classes that
  // already exist under it (e.g. an admin re-opening this wizard after a
  // partial rollover, or one who pre-created next year's classes by
  // hand) so the preview offers to reuse them instead of silently
  // planning to create duplicates.
  let existingNextYearClasses: {
    id: string;
    education_level: EducationLevel;
    level_number: number;
    arm: string | null;
  }[] = [];
  if (suggestedNextAcademicYear) {
    const { data } = await admin
      .from("classes")
      .select("id, education_level, level_number, arm")
      .eq("academic_year", suggestedNextAcademicYear);
    existingNextYearClasses = data ?? [];
  }

  const preview: RolloverClassPreview[] = (classes ?? []).map((cls) => {
    const nextLevel = nextLevelFor(cls.education_level, cls.level_number);
    const existing = nextLevel
      ? existingNextYearClasses.find(
          (c) =>
            c.education_level === nextLevel.educationLevel &&
            c.level_number === nextLevel.levelNumber &&
            (c.arm ?? null) === (cls.arm ?? null)
        )
      : undefined;

    return {
      id: cls.id,
      name: cls.name,
      arm: cls.arm,
      educationLevel: cls.education_level,
      levelNumber: cls.level_number,
      academicYear: cls.academic_year,
      studentCount: countByClass.get(cls.id) ?? 0,
      nextLevel,
      existingTargetClassId: existing?.id ?? null,
    };
  });

  return {
    currentAcademicYear,
    currentTerm,
    currentTermStartDate,
    suggestedNextAcademicYear,
    classes: preview,
  };
}

export type RolloverClassDecision = {
  sourceClassId: string;
  action: PromotionOutcome | "skip";
  /** Reuse this existing class as the destination instead of creating one. Ignored for graduate/skip. */
  targetClassId?: string | null;
};

export type RolloverInput = {
  nextAcademicYear: string;
  nextTermStartDate: string | null;
  decisions: RolloverClassDecision[];
  /** Mark the rolled-over source classes as archived once their students have moved on. */
  archiveSourceClasses: boolean;
};

export type RolloverResult = {
  classesCreated: number;
  studentsPromoted: number;
  studentsRepeated: number;
  studentsGraduated: number;
  classesArchived: number;
  errors: string[];
};

export async function runAcademicYearRollover(input: RolloverInput): Promise<RolloverResult> {
  const { id: actorId } = await assertRole(
    ["admin"],
    "Only an admin can run the academic year rollover."
  );
  const admin = createAdminClient();

  const nextAcademicYear = input.nextAcademicYear.trim();
  if (!nextAcademicYear) {
    throw new Error("Enter the next academic year (e.g. 2026/2027).");
  }

  const { data: currentSettings } = await admin
    .from("school_settings")
    .select("current_academic_year")
    .eq("id", 1)
    .single();

  if (currentSettings?.current_academic_year === nextAcademicYear) {
    throw new Error("That's already the current academic year.");
  }

  const errors: string[] = [];
  let classesCreated = 0;
  let studentsPromoted = 0;
  let studentsRepeated = 0;
  let studentsGraduated = 0;
  let classesArchived = 0;

  // 1. Resolve/create every destination class up front, before touching
  // settings or any student -- if class creation fails partway through,
  // nothing about the current term has been disturbed yet.
  const targetClassIdByDecision = new Map<string, string>();

  for (const decision of input.decisions) {
    if (decision.action === "skip" || decision.action === "graduate") continue;

    const source = await admin
      .from("classes")
      .select("id, arm")
      .eq("id", decision.sourceClassId)
      .single();
    if (!source.data) {
      errors.push(`Source class ${decision.sourceClassId} not found -- skipped.`);
      continue;
    }

    if (decision.targetClassId) {
      targetClassIdByDecision.set(decision.sourceClassId, decision.targetClassId);
      continue;
    }

    const sourceClass = await admin
      .from("classes")
      .select("education_level, level_number, arm")
      .eq("id", decision.sourceClassId)
      .single();
    if (!sourceClass.data) {
      errors.push(`Source class ${decision.sourceClassId} not found -- skipped.`);
      continue;
    }

    const nextLevel =
      decision.action === "repeat"
        ? {
            educationLevel: sourceClass.data.education_level,
            levelNumber: sourceClass.data.level_number,
          }
        : nextLevelFor(sourceClass.data.education_level, sourceClass.data.level_number);

    if (!nextLevel) {
      errors.push(
        `Class ${decision.sourceClassId} has no further level to promote into -- use "graduate" instead.`
      );
      continue;
    }

    // Idempotency: if this exact target already exists (e.g. the wizard
    // is being re-run after a partial failure), reuse it instead of
    // creating a duplicate class. Arm needs an `is`/`eq` split since
    // `.eq("arm", "")` does NOT match a NULL arm column in Postgres.
    let existingQuery = admin
      .from("classes")
      .select("id")
      .eq("academic_year", nextAcademicYear)
      .eq("education_level", nextLevel.educationLevel)
      .eq("level_number", nextLevel.levelNumber);
    existingQuery = sourceClass.data.arm
      ? existingQuery.eq("arm", sourceClass.data.arm)
      : existingQuery.is("arm", null);
    const { data: existing } = await existingQuery.maybeSingle();

    if (existing?.id) {
      targetClassIdByDecision.set(decision.sourceClassId, existing.id);
      continue;
    }

    const { data: created, error: createError } = await admin
      .from("classes")
      .insert({
        name: `${STAGE_LABEL[nextLevel.educationLevel]} ${nextLevel.levelNumber}`,
        arm: sourceClass.data.arm,
        education_level: nextLevel.educationLevel,
        level_number: nextLevel.levelNumber,
        academic_year: nextAcademicYear,
      })
      .select("id")
      .single();

    if (createError || !created) {
      errors.push(
        `Failed to create destination class for ${decision.sourceClassId}: ${createError?.message}`
      );
      continue;
    }

    classesCreated += 1;
    targetClassIdByDecision.set(decision.sourceClassId, created.id);
  }

  // 2. Flip the academic year/term. Everything after this point --
  // promoteStudents()'s enrollment upserts included -- reads
  // school_settings for "the current term", so this has to happen before
  // any student gets moved, not after.
  const { error: settingsError } = await admin
    .from("school_settings")
    .update({
      current_academic_year: nextAcademicYear,
      current_term: 1,
      current_term_start_date: input.nextTermStartDate || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (settingsError) {
    throw new Error(`Failed to update school settings: ${settingsError.message}`);
  }

  // 3. Move students. promoteStudents() (lib/actions/admin.ts) already
  // handles the class_id update + enrollment upsert atomically per call
  // and is the same code path the existing per-class "Promote Students"
  // page uses -- reusing it here means the rollover wizard can't drift
  // out of sync with that page's behavior.
  for (const decision of input.decisions) {
    if (decision.action === "skip") continue;

    const { data: studentsInClass } = await admin
      .from("student_profiles")
      .select("id")
      .eq("class_id", decision.sourceClassId);

    const studentIds = (studentsInClass ?? []).map((s) => s.id);
    if (!studentIds.length) continue;

    const targetClassId =
      decision.action === "graduate" ? null : targetClassIdByDecision.get(decision.sourceClassId);

    if (decision.action !== "graduate" && !targetClassId) {
      errors.push(
        `No destination class resolved for ${decision.sourceClassId} -- students left in place.`
      );
      continue;
    }

    try {
      const result = await promoteStudents({
        studentIds,
        targetClassId: targetClassId ?? null,
        outcome: decision.action,
      });
      if (decision.action === "promote") studentsPromoted += result.succeeded;
      else if (decision.action === "repeat") studentsRepeated += result.succeeded;
      else if (decision.action === "graduate") studentsGraduated += result.succeeded;
      errors.push(...result.errors);
    } catch (err: any) {
      errors.push(`Class ${decision.sourceClassId}: ${err.message ?? "promotion failed"}`);
    }

    if (input.archiveSourceClasses) {
      const { error: archiveError } = await admin
        .from("classes")
        .update({ is_archived: true })
        .eq("id", decision.sourceClassId);
      if (!archiveError) classesArchived += 1;
    }
  }

  await writeAuditLog({
    entityType: "school_settings",
    entityId: "1",
    action: "academic_year_rollover",
    actorId,
    metadata: {
      from_academic_year: currentSettings?.current_academic_year ?? null,
      to_academic_year: nextAcademicYear,
      classes_created: classesCreated,
      students_promoted: studentsPromoted,
      students_repeated: studentsRepeated,
      students_graduated: studentsGraduated,
      classes_archived: classesArchived,
      error_count: errors.length,
    },
  });

  revalidatePath("/dashboard/admin/rollover");
  revalidatePath("/dashboard/admin/classes");
  revalidatePath("/dashboard/admin/students");
  revalidatePath("/dashboard/admin/settings");

  return {
    classesCreated,
    studentsPromoted,
    studentsRepeated,
    studentsGraduated,
    classesArchived,
    errors,
  };
}
