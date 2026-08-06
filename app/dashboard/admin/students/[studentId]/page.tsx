import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EditStudentForm } from "@/components/EditStudentForm";
import { StudentPhotoUpload } from "@/components/StudentPhotoUpload";
import { formatLevel } from "@/types/database";
import { createAdminClient } from "@/lib/supabase/admin";
import { STUDENT_PHOTO_BUCKET } from "@/lib/storageBuckets";

export default async function StudentInfoPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const resolvedParams = await params;

  const supabase = createClient();

  const { data: student } = await supabase
    .from("student_profiles")
    .select(
      "*, profiles(full_name, avatar_url, profile_contacts(email)), classes(id, name, arm, education_level, level_number)"
    )
    .eq("id", resolvedParams.studentId)
    .single();

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, arm")
    .eq("is_archived", false)
    .order("education_level", { ascending: true })
    .order("level_number", { ascending: true });

  const profile = student?.profiles;
  const cls = student?.classes;
  const photoPath = profile?.avatar_url;
  const { data: signedPhoto } = photoPath
    ? await createAdminClient()
        .storage.from(STUDENT_PHOTO_BUCKET)
        .createSignedUrl(photoPath, 60 * 60)
    : { data: null };

  return (
    <div>
      <div className="mb-1 flex items-start justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-ink">
          {profile?.full_name ?? "Student"}
        </h1>
        {student && (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/admin/id-cards/print?studentId=${resolvedParams.studentId}`}
              className="whitespace-nowrap rounded-lg border border-rule px-3 py-1.5 text-sm font-medium text-ink hover:bg-leaf-soft"
            >
              Print ID Card
            </Link>
            <Link
              href={`/dashboard/admin/students/${resolvedParams.studentId}/admission-letter`}
              className="whitespace-nowrap rounded-lg border border-rule px-3 py-1.5 text-sm font-medium text-ink hover:bg-leaf-soft"
            >
              Admission Letter
            </Link>
            <Link
              href={`/dashboard/admin/students/${resolvedParams.studentId}/testimonial`}
              className="whitespace-nowrap rounded-lg border border-rule px-3 py-1.5 text-sm font-medium text-ink hover:bg-leaf-soft"
            >
              Testimonial
            </Link>
          </div>
        )}
      </div>
      <p className="mb-6 text-sm text-ink-soft">
        {profile?.profile_contacts?.email}
        {cls
          ? ` · ${cls.name} ${cls.arm ?? ""} (${formatLevel(cls.education_level, cls.level_number)})`
          : " · Unassigned"}
      </p>

      {student ? (
        <div className="space-y-4">
          <StudentPhotoUpload
            studentId={resolvedParams.studentId}
            fullName={profile?.full_name ?? "Student"}
            photoUrl={signedPhoto?.signedUrl ?? null}
          />
          <EditStudentForm
            studentId={resolvedParams.studentId}
            currentFullName={profile?.full_name ?? ""}
            currentAdmissionNo={student.admission_no}
            currentGuardianName={student.guardian_name}
            currentGuardianPhone={student.guardian_phone}
            currentClassId={student.class_id}
            currentGender={student.gender}
            classes={classes ?? []}
          />
        </div>
      ) : (
        <p className="text-sm text-clay">Student not found.</p>
      )}
    </div>
  );
}
