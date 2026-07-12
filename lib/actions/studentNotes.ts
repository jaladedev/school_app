"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import type { StudentNoteType } from "@/types/database";

export async function createStudentNote(input: {
  studentId: string;
  noteType: StudentNoteType;
  content: string;
  visibleToStudent: boolean;
}) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "teacher")) {
    throw new Error("Only staff can add student notes.");
  }

  const supabase = createClient();

  const { error } = await supabase.from("student_notes").insert({
    student_id: input.studentId,
    author_id: profile.id,
    note_type: input.noteType,
    content: input.content,
    visible_to_student: input.visibleToStudent,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/admin/students/${input.studentId}/notes`);
}