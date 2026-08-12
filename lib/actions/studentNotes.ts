"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertRole } from "@/lib/actions/authGuards";
import type { StudentNoteType } from "@/types/database";
import { throwDbError } from "@/lib/errors/db";

const MAX_NOTE_LENGTH = 5000;

export async function createStudentNote(input: {
  studentId: string;
  noteType: StudentNoteType;
  content: string;
  visibleToStudent: boolean;
}) {
  const { id: authorId } = await assertRole(
    ["admin", "teacher"],
    "Only staff can add student notes."
  );

  const trimmed = input.content.trim();
  if (!trimmed) throw new Error("Note content is required.");
  if (trimmed.length > MAX_NOTE_LENGTH) {
    throw new Error(`Note must be ${MAX_NOTE_LENGTH.toLocaleString()} characters or fewer.`);
  }

  const supabase = createClient();

  const { error } = await supabase.from("student_notes").insert({
    student_id: input.studentId,
    author_id: authorId,
    note_type: input.noteType,
    content: trimmed,
    visible_to_student: input.visibleToStudent,
  });

  if (error) throwDbError(error);

  revalidatePath(`/dashboard/admin/students/${input.studentId}/notes`);
  revalidatePath("/dashboard/student/notes");
}
