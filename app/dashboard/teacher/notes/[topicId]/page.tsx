import Link from "next/link";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NoteWorkspace } from "@/components/NoteWorkspace";
import { TopicResourceUpload } from "@/components/TopicResourceUpload";
import { TopicResourceList } from "@/components/TopicResourceList";
import { NoteVersionDiff } from "@/components/NoteVersionDiff";
import { RestoreVersionButton } from "@/components/RestoreVersionButton";
import { DeleteVersionButton } from "@/components/DeleteVersionButton";
import { formatLevel } from "@/types/database";

export default async function TeacherNoteEditPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const resolvedParams = await params;

  const profile = await getCurrentProfile();
  const supabase = createClient();

  const { data: topic } = await supabase
    .from("curriculum_topics")
    .select("*, subjects(name)")
    .eq("id", resolvedParams.topicId)
    .single();

  const { data: note } = await supabase
    .from("topic_notes")
    .select("*")
    .eq("topic_id", resolvedParams.topicId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: versions } = await supabase
    .from("topic_notes")
    .select("id, version, status, moderation_status, updated_at, author_id, profiles(full_name)")
    .eq("topic_id", resolvedParams.topicId)
    .order("version", { ascending: false });

  // Scoped to this specific note version, not the whole topic — same fix
  // as the student-facing topic page. Without this, a teacher editing a
  // fresh draft would see resources left over from an earlier, superseded
  // note version mixed in with what actually belongs to the draft they're
  // working on.
  const { data: resources } = note
    ? await supabase
        .from("topic_resources")
        .select("*")
        .eq("note_id", note.id)
        .order("sequence_order", { ascending: true })
    : { data: [] };

  // `file_url` on the row is a private-bucket object path, not a
  // fetchable URL -- same signing the student-facing topic page already
  // does. Without this, every image/video/audio/PDF resource in the
  // note editor renders as a broken-media placeholder on every load,
  // not just right after upload.
  //
  // Each resource is signed independently and never throws out of this
  // map -- an admin/storage error for one resource (bad bucket name,
  // expired service role key, a since-deleted object) used to reject
  // the whole Promise.all, which fails this entire Server Component
  // and takes the rest of the page -- including the resource list that
  // *doesn't* need signing -- down with it. Falling back to the
  // resource's original (unsigned) file_url on error keeps that one
  // item merely broken-looking, exactly like before this signing step
  // existed, instead of blanking out every resource on the page.
  const admin = createAdminClient();
  const signedResources = await Promise.all(
    (resources ?? []).map(async (resource) => {
      if (!resource.file_url || resource.file_url.startsWith("http")) return resource;
      try {
        const { data: signed, error } = await admin.storage
          .from("topic-resources")
          .createSignedUrl(resource.file_url, 6 * 60 * 60);
        if (error || !signed?.signedUrl) return resource;
        return { ...resource, file_url: signed.signedUrl };
      } catch {
        return resource;
      }
    })
  );

  // For the bell timer shown in Present mode — today's schedule for this
  // teacher, same query/shape the teacher dashboard already uses.
  const today = new Date();
  const todayWeekday = today.getDay() === 0 ? 7 : today.getDay();
  const { data: todaysEntries } = profile
    ? await supabase
        .from("timetable_entries")
        .select("id, period_number, start_time, end_time, classes(name, arm), subjects(name)")
        .eq("teacher_id", profile.id)
        .eq("weekday", todayWeekday)
        .order("period_number", { ascending: true })
    : { data: [] };

  return (
    <div>
      <Link
        href="/dashboard/teacher/notes"
        className="mb-2 inline-block text-sm text-leaf hover:underline"
      >
        ← My subjects
      </Link>
      <p className="mb-1 text-xs uppercase tracking-wide text-leaf">
        {topic?.subjects?.name} · {topic && formatLevel(topic.education_level, topic.level_number)}{" "}
        · Term {topic?.term}
      </p>
      <h1 className="mb-6 font-display text-2xl font-semibold text-ink">{topic?.title}</h1>

      {note?.status === "published" && (
        <p className="mb-4 text-xs font-medium">
          {note.moderation_status === "pending" && (
            <span className="rounded-full bg-marigold/20 px-2.5 py-1 text-marigold-dark">
              Awaiting HOD review — not visible to students yet
            </span>
          )}
          {note.moderation_status === "approved" && (
            <span className="rounded-full bg-leaf-soft px-2.5 py-1 text-leaf">
              Approved — visible to students
            </span>
          )}
          {note.moderation_status === "rejected" && (
            <span className="rounded-full bg-clay/20 px-2.5 py-1 text-clay">
              Rejected by HOD — edit and republish to resubmit
            </span>
          )}
        </p>
      )}

      <NoteWorkspace
        topicId={resolvedParams.topicId}
        noteId={note?.id}
        initialContent={note?.content ?? ""}
        initialStatus={note?.status ?? "unwritten"}
        resources={signedResources}
        placeholder={`Write about "${topic?.title}" here. Use tables for summaries, and the ∑ button for math.`}
        todaysEntries={(todaysEntries ?? []).map((entry) => ({
          id: entry.id,
          periodNumber: entry.period_number,
          startTime: entry.start_time,
          endTime: entry.end_time,
          subjectName: entry.subjects?.name ?? "",
          className: `${entry.classes?.name ?? ""} ${entry.classes?.arm ?? ""}`.trim(),
        }))}
      />
      {note ? (
        <section className="mt-4">
          <TopicResourceUpload topicId={resolvedParams.topicId} noteId={note.id} />
          <TopicResourceList resources={resources ?? []} />
        </section>
      ) : (
        <p className="mt-4 text-sm text-ink-soft">
          This list will appear here once you&apos;ve saved at least one draft — but you don&apos;t
          have to save first: use &quot;Insert resource&quot; or drag a file straight into the
          editor above, and the first draft will be created for you automatically.
        </p>
      )}
      {!!versions?.length && (
        <section className="mt-6 rounded-xl border border-rule bg-white p-4">
          <h2 className="font-display text-lg font-semibold text-ink">Version history</h2>
          <div className="mt-3 space-y-2">
            {versions.map((version, i) => (
              <div
                key={version.id}
                className="flex items-center justify-between rounded-lg bg-paper px-3 py-2 text-sm"
              >
                <span className="font-medium text-ink">Version {version.version}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-ink-soft">
                    {/* `profiles` comes back as an array from this join
                        shape even though author_id -> profiles is a
                        single row; take the first entry. */}
                    {(Array.isArray(version.profiles) ? version.profiles[0] : version.profiles)
                      ?.full_name ?? "Unknown author"}{" "}
                    · {version.status}
                    {version.status === "published" ? ` (${version.moderation_status})` : ""} ·{" "}
                    {new Date(version.updated_at).toLocaleString()}
                  </span>
                  <RestoreVersionButton
                    topicId={resolvedParams.topicId}
                    versionNoteId={version.id}
                    versionNumber={version.version}
                    isLatest={i === 0}
                  />
                  <DeleteVersionButton
                    topicId={resolvedParams.topicId}
                    versionNoteId={version.id}
                    versionNumber={version.version}
                    disabled={versions.length <= 1}
                  />
                </div>
              </div>
            ))}
          </div>
          <NoteVersionDiff versions={versions} />
        </section>
      )}
    </div>
  );
}
