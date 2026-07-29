import type { EducationLevel } from "@/types/database";

// Mirrors valid_level_number() in the DB and LEVEL_OPTIONS in
// CreateClassForm.tsx -- keep all three in sync if the level structure
// ever changes.
const LEVEL_MAX: Record<EducationLevel, number> = { primary: 6, jss: 3, sss: 3 };

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
