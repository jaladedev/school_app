import Link from "next/link";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { NoteEditor } from "@/components/NoteEditor";
import { TopicResourceUpload } from "@/components/TopicResourceUpload";
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
    .select("id, version, status, updated_at")
    .eq("topic_id", resolvedParams.topicId)
    .order("version", { ascending: false });

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

      <NoteEditor
        topicId={resolvedParams.topicId}
        initialContent={note?.content ?? `## Introduction\n\nWrite about "${topic?.title}" here.\n`}
        initialStatus={note?.status ?? "unwritten"}
      />
      {note ? (
        <TopicResourceUpload topicId={resolvedParams.topicId} noteId={note.id} />
      ) : (
        <p className="mt-4 text-sm text-ink-soft">Save the note once before attaching resources.</p>
      )}
      {!!versions?.length && (
        <section className="mt-6 rounded-xl border border-rule bg-white p-4">
          <h2 className="font-display text-lg font-semibold text-ink">Version history</h2>
          <div className="mt-3 space-y-2">
            {versions.map((version) => (
              <div
                key={version.id}
                className="flex items-center justify-between rounded-lg bg-paper px-3 py-2 text-sm"
              >
                <span className="font-medium text-ink">Version {version.version}</span>
                <span className="text-xs text-ink-soft">
                  {version.status} · {new Date(version.updated_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
