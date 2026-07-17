import { z } from "zod";

export const createStudentSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the student's full name."),
  email: z.string().trim().email("Enter a valid email address."),
  temporaryPassword: z.string().min(8, "Password must be at least 8 characters."),
  classId: z.string().min(1, "Select a class."),
  admissionNo: z.string().trim().optional(),
  guardianName: z.string().trim().optional(),
  guardianPhone: z.string().trim().optional(),
});
export type CreateStudentInput = z.infer<typeof createStudentSchema>;

export const createTeacherSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the teacher's full name."),
  email: z.string().trim().email("Enter a valid email address."),
  temporaryPassword: z.string().min(8, "Password must be at least 8 characters."),
  subjectIds: z.array(z.string()).min(1, "Select at least one subject."),
});
export type CreateTeacherInput = z.infer<typeof createTeacherSchema>;

export const createClassSchema = z.object({
  educationLevel: z.enum(["primary", "jss", "sss"]),
  levelNumber: z.coerce.number().int().min(1, "Level must be 1 or higher."),
  arm: z.string().trim().optional(),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}\/\d{4}$/, "Use the format 2025/2026."),
});
export type CreateClassInput = z.infer<typeof createClassSchema>;

export const timetableEntrySchema = z
  .object({
    weekday: z.coerce.number().int().min(1, "Pick a weekday.").max(7, "Pick a valid weekday."),
    periodNumber: z.coerce.number().int().min(1, "Period must be 1 or higher."),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Enter a start time."),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Enter an end time."),
    subjectId: z.string().min(1, "Select a subject."),
    teacherId: z.string().min(1, "Select a teacher."),
    room: z.string().trim().optional(),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "End time must be after start time.",
    path: ["endTime"],
  });
export type TimetableEntryInput = z.infer<typeof timetableEntrySchema>;

export const createAssessmentSchema = z.object({
  subjectId: z.string().min(1, "Select a subject."),
  classId: z.string().min(1, "Select a class."),
  term: z.coerce.number().int().min(1).max(3, "Term must be 1, 2, or 3."),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}\/\d{4}$/, "Use the format 2025/2026."),
  customTitle: z.string().trim().optional(),
  customMaxScore: z.coerce.number().int().min(1, "Max score must be at least 1.").optional(),
});
export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;

export const announcementSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters."),
  content: z.string().trim().min(10, "Write at least a short sentence."),
  audience: z.enum(["all", "students", "teachers", "class"]),
  classId: z.string().optional(),
});
export type AnnouncementInput = z.infer<typeof announcementSchema>;

/**
 * Runs a zod schema and returns field-level error messages keyed by
 * field name, suitable for rendering inline under each input. Returns
 * null if validation passed.
 */
export function fieldErrorsFrom<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): Record<string, string> | null {
  const result = schema.safeParse(data);
  if (result.success) return null;

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}
