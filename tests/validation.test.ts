import { describe, expect, it } from "vitest";
import {
  announcementSchema,
  createAssessmentSchema,
  createClassSchema,
  createStudentSchema,
  createTeacherSchema,
  fieldErrorsFrom,
  timetableEntrySchema,
} from "@/lib/validation";

describe("form validation", () => {
  it("accepts valid student and teacher records", () => {
    expect(
      createStudentSchema.safeParse({
        fullName: "Ada Lovelace",
        email: "ada@example.com",
        temporaryPassword: "password1",
        classId: "class-1",
      }).success
    ).toBe(true);
    expect(
      createTeacherSchema.safeParse({
        fullName: "Grace Hopper",
        email: "grace@example.com",
        temporaryPassword: "password1",
        subjectIds: ["maths"],
      }).success
    ).toBe(true);
  });

  it("rejects invalid required fields", () => {
    const errors = fieldErrorsFrom(createStudentSchema, {
      fullName: "A",
      email: "bad-email",
      temporaryPassword: "short",
      classId: "",
    });
    expect(errors).toMatchObject({
      fullName: "Enter the student's full name.",
      email: "Enter a valid email address.",
      temporaryPassword: "Password must be at least 8 characters.",
      classId: "Select a class.",
    });
  });

  it("coerces valid numeric inputs and rejects invalid class, assessment, and timetable values", () => {
    expect(
      createClassSchema.parse({
        educationLevel: "jss",
        levelNumber: "2",
        academicYear: "2025/2026",
      }).levelNumber
    ).toBe(2);
    expect(
      createAssessmentSchema.safeParse({
        subjectId: "s",
        classId: "c",
        term: 4,
        academicYear: "2025/2026",
      }).success
    ).toBe(false);
    expect(
      timetableEntrySchema.safeParse({
        weekday: 1,
        periodNumber: 1,
        startTime: "10:00",
        endTime: "09:00",
        subjectId: "s",
        teacherId: "t",
      }).success
    ).toBe(false);
    expect(
      announcementSchema.safeParse({ title: "Hi", content: "Too short", audience: "all" }).success
    ).toBe(false);
  });

  it("returns null when a form is valid", () => {
    expect(
      fieldErrorsFrom(announcementSchema, {
        title: "School meeting",
        content: "Parents should attend the school meeting.",
        audience: "all",
      })
    ).toBeNull();
  });
});
