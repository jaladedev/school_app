import { createClient } from "@/lib/supabase/server";
import { EditStudentForm } from "@/components/EditStudentForm";
import { formatLevel } from "@/types/database";

export default async function StudentInfoPage({
  params,
}: {
  params: { studentId: string };
}) {
  const supabase = createClient();

  const { data: student } = await supabase
    .from("student_profiles")
    .select("*, profiles(full_name, email), classes(id, name, arm, education_level, level_number)")
    .eq("id", params.studentId)
    .single();

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, arm")
    .eq("is_archived", false)
    .order("education_level", { ascending: true })
    .order("level_number", { ascending: true });

  const profile = student?.profiles;
  const cls = student?.classes;

  return (
    <div>

      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">
        {profile?.full_name ?? "Student"}
      </h1>
      <p className="mb-6 text-sm text-ink-soft">
        {profile?.email}
        {cls ? ` · ${cls.name} ${cls.arm ?? ""} (${formatLevel(cls.education_level, cls.level_number)})` : " · Unassigned"}
      </p>

      {student ? (
        <EditStudentForm
          studentId={params.studentId}
          currentFullName={profile?.full_name ?? ""}
          currentAdmissionNo={student.admission_no}
          currentGuardianName={student.guardian_name}
          currentGuardianPhone={student.guardian_phone}
          currentClassId={student.class_id}
          classes={classes ?? []}
        />
      ) : (
        <p className="text-sm text-clay">Student not found.</p>
      )}
    </div>
  );
}