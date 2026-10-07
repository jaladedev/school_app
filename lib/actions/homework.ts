"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertRole } from "@/lib/actions/authGuards";
import { writeAuditLog } from "@/lib/audit";
import { throwDbError } from "@/lib/errors/db";
import { runAction, type ActionResult } from "@/lib/actionResult";
import { cleanHomeworkFields, isIsoDate } from "@/lib/homeworkValidation";

function revalidateHomeworkPages() {
  revalidatePath("/dashboard/teacher");
  revalidatePath("/dashboard/teacher/homework");
  revalidatePath("/dashboard/student/homework");
  revalidatePath("/dashboard/parent/homework");
}

/** One day of slack so a teacher a timezone ahead of the server can still pick "today". */
function latestAllowedLessonDate(): string {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Give homework without going through "Log lesson". Homework lives on the
 * lessons table, so this attaches it to the lesson already logged for that
 * period and date -- or creates the lesson (with just the homework) if
 * there isn't one yet.
 */
export async function giveHomework(input: {
  timetableEntryId: string;
  lessonDate: string;
  homework: string;
  homeworkDueAt?: string;
}): Promise<ActionResult<{ lessonId: string }>> {
  return runAction(async () => {
    const { id: teacherId } = await assertRole(["teacher"], "Only teachers can give homework.");
    const supabase = createClient();

    if (!isIsoDate(input.lessonDate)) throw new Error("Pick a valid lesson date.");
    if (input.lessonDate > latestAllowedLessonDate()) {
      throw new Error("The lesson date can't be in the future.");
    }
    const fields = cleanHomeworkFields(input);

    // Class comes from the timetable entry, never from the client.
    const { data: entry } = await supabase
      .from("timetable_entries")
      .select("teacher_id, class_id, classes(name, arm)")
      .eq("id", input.timetableEntryId)
      .single();
    if (!entry) throw new Error("Pick a class and subject from your timetable.");
    if (entry.teacher_id !== teacherId) {
      throw new Error(`You aren't assigned to this period for ${entry.classes?.name ?? "this class"}.`);
    }

    const { data: existing } = await supabase
      .from("lessons")
      .select("id, homework")
      .eq("timetable_entry_id", input.timetableEntryId)
      .eq("lesson_date", input.lessonDate)
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let lessonId: string;

    if (existing) {
      if (existing.homework) {
        throw new Error(
          "Homework was already given for this class on that date. Edit it from the list below instead."
        );
      }
      const { error } = await supabase
        .from("lessons")
        .update({ homework: fields.homework, homework_due_at: fields.homeworkDueAt })
        .eq("id", existing.id);
      if (error) throwDbError(error);
      lessonId = existing.id;
    } else {
      const { data: lesson, error } = await supabase
        .from("lessons")
        .insert({
          timetable_entry_id: input.timetableEntryId,
          class_id: entry.class_id,
          teacher_id: teacherId,
          lesson_date: input.lessonDate,
          homework: fields.homework,
          homework_due_at: fields.homeworkDueAt,
        })
        .select("id")
        .single();
      if (error) throwDbError(error);
      lessonId = lesson.id;
    }

    await writeAuditLog({
      entityType: "lesson",
      entityId: lessonId,
      action: "homework_given",
      actorId: teacherId,
      metadata: { due_at: fields.homeworkDueAt, lesson_date: input.lessonDate },
    });

    revalidateHomeworkPages();
    return { lessonId };
  });
}

/**
 * Edit the text and/or due date of homework already given. The teacher who
 * gave it only, and not once it's been marked graded (reopen it first) --
 * a grade was awarded against the old wording.
 */
export async function updateHomework(
  lessonId: string,
  input: { homework: string; homeworkDueAt?: string }
): Promise<ActionResult> {
  return runAction(async () => {
    const { id: teacherId } = await assertRole(["teacher"], "Only teachers can edit homework.");
    const supabase = createClient();

    const { data: lesson } = await supabase
      .from("lessons")
      .select("teacher_id, lesson_date, homework, homework_status")
      .eq("id", lessonId)
      .single();
    if (!lesson) throw new Error("Lesson not found.");
    if (lesson.teacher_id !== teacherId) {
      throw new Error("You can only edit homework you gave.");
    }
    if (!lesson.homework) {
      throw new Error("There's no homework on this lesson yet. Use Give homework instead.");
    }
    if (lesson.homework_status === "graded") {
      throw new Error("Graded homework can't be edited. Reopen it first.");
    }

    const fields = cleanHomeworkFields({ ...input, lessonDate: lesson.lesson_date });

    const { error } = await supabase
      .from("lessons")
      .update({ homework: fields.homework, homework_due_at: fields.homeworkDueAt })
      .eq("id", lessonId);
    if (error) throwDbError(error);

    await writeAuditLog({
      entityType: "lesson",
      entityId: lessonId,
      action: "homework_edited",
      actorId: teacherId,
      metadata: { due_at: fields.homeworkDueAt },
    });

    revalidateHomeworkPages();
  });
}
