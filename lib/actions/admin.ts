"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function assertIsAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    throw new Error("Only an admin can create accounts.");
  }
}

function generateTempPassword() {
  // Simple readable temp password: e.g. "river-42-otter". Good enough to
  // hand to a student/parent verbally or on a printed slip; they should
  // change it after first login if you add that flow later.
  const words = ["river", "otter", "cedar", "maple", "coral", "amber", "birch", "delta"];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(10 + Math.random() * 89);
  return `${word}-${num}-${words[Math.floor(Math.random() * words.length)]}`;
}

export async function createTeacherAccount(input: {
  fullName: string;
  email: string;
  temporaryPassword: string;
  subjectIds: string[];
}) {
  await assertIsAdmin();
  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.temporaryPassword,
    email_confirm: true,
  });

  if (createError || !created.user) {
    throw new Error(createError?.message ?? "Failed to create the auth account.");
  }

  const userId = created.user.id;

  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    role: "teacher",
    full_name: input.fullName,
    email: input.email,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    throw new Error(profileError.message);
  }

  const { error: teacherError } = await admin.from("teacher_profiles").insert({
    id: userId,
    subjects_taught: input.subjectIds,
    hire_date: new Date().toISOString().slice(0, 10),
  });

  if (teacherError) {
    await admin.auth.admin.deleteUser(userId);
    throw new Error(teacherError.message);
  }

  revalidatePath("/dashboard/admin/staff");
  return { userId };
}

export async function createStudentAccount(input: {
  fullName: string;
  email: string;
  temporaryPassword: string;
  classId: string;
  admissionNo?: string;
  guardianName?: string;
  guardianPhone?: string;
}) {
  await assertIsAdmin();
  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.temporaryPassword,
    email_confirm: true,
  });

  if (createError || !created.user) {
    throw new Error(createError?.message ?? "Failed to create the auth account.");
  }

  const userId = created.user.id;

  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    role: "student",
    full_name: input.fullName,
    email: input.email,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    throw new Error(profileError.message);
  }

  const { error: studentError } = await admin.from("student_profiles").insert({
    id: userId,
    class_id: input.classId,
    admission_no: input.admissionNo ?? null,
    guardian_name: input.guardianName ?? null,
    guardian_phone: input.guardianPhone ?? null,
  });

  if (studentError) {
    await admin.auth.admin.deleteUser(userId);
    throw new Error(studentError.message);
  }

  revalidatePath("/dashboard/admin/students");
  return { userId };
}

export type BulkStudentRow = {
  fullName: string;
  email: string;
  admissionNo?: string;
  guardianName?: string;
  guardianPhone?: string;
};

export type BulkStudentResult = {
  email: string;
  fullName: string;
  success: boolean;
  password?: string;
  error?: string;
};

export async function createStudentsBulk(input: {
  classId: string;
  students: BulkStudentRow[];
  passwordStrategy: "auto" | "shared";
  sharedPassword?: string;
}): Promise<BulkStudentResult[]> {
  await assertIsAdmin();
  const admin = createAdminClient();

  if (
    input.passwordStrategy === "shared" &&
    (!input.sharedPassword || input.sharedPassword.length < 8)
  ) {
    throw new Error("Shared password must be at least 8 characters.");
  }

  const results: BulkStudentResult[] = [];

  // Sequential, not Promise.all — the Admin API can rate-limit bursts of
  // createUser calls, and sequential also makes partial-failure results
  // easier to reason about (each row's error is independent and clear).
  for (const row of input.students) {
    const password =
      input.passwordStrategy === "shared" ? input.sharedPassword! : generateTempPassword();

    try {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: row.email,
        password,
        email_confirm: true,
      });

      if (createError || !created.user) {
        results.push({
          email: row.email,
          fullName: row.fullName,
          success: false,
          error: createError?.message ?? "Account creation failed.",
        });
        continue;
      }

      const userId = created.user.id;

      const { error: profileError } = await admin.from("profiles").insert({
        id: userId,
        role: "student",
        full_name: row.fullName,
        email: row.email,
      });

      if (profileError) {
        await admin.auth.admin.deleteUser(userId);
        results.push({
          email: row.email,
          fullName: row.fullName,
          success: false,
          error: profileError.message,
        });
        continue;
      }

      const { error: studentError } = await admin.from("student_profiles").insert({
        id: userId,
        class_id: input.classId,
        admission_no: row.admissionNo ?? null,
        guardian_name: row.guardianName ?? null,
        guardian_phone: row.guardianPhone ?? null,
      });

      if (studentError) {
        await admin.auth.admin.deleteUser(userId);
        results.push({
          email: row.email,
          fullName: row.fullName,
          success: false,
          error: studentError.message,
        });
        continue;
      }

      results.push({
        email: row.email,
        fullName: row.fullName,
        success: true,
        password,
      });
    } catch (err: any) {
      results.push({
        email: row.email,
        fullName: row.fullName,
        success: false,
        error: err.message ?? "Unexpected error.",
      });
    }
  }

  revalidatePath("/dashboard/admin/students");
  return results;
}

export async function reassignStudentClass(studentId: string, classId: string) {
  await assertIsAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("student_profiles")
    .update({ class_id: classId })
    .eq("id", studentId);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin/students");
}