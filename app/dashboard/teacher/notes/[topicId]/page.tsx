import Link from "next/link";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { NoteEditor } from "@/components/NoteEditor";
import { formatLevel } from "@/types/database";

export default async function TeacherNoteEditPage({
  params,
}: {
  params: { topicId: string };
}) {
  const profile = await getCurrentProfile();
  const supabase = createClient();

  const { data: topic } = await supabase
    .from("curriculum_topics")
    .select("*, subjects(name)")
    .eq("id", params.topicId)
    .single();

  const { data: note } = await supabase
    .from("topic_notes")
    .select("*")
    .eq("topic_id", params.topicId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div>
      <Link
        href="/dashboard/teacher/notes"
        className="mb-2 inline-block text-sm text-leaf hover:underline"
      >
        ← My subjects
      </Link>
      <p className="mb-1 text-xs uppercase tracking-wide text-leaf">
        {topic?.subjects?.name} ·{" "}
        {topic && formatLevel(topic.education_level, topic.level_number)} · Term{" "}
        {topic?.term}
      </p>
      <h1 className="mb-6 font-display text-2xl font-semibold text-ink">
        {topic?.title}
      </h1>

      <NoteEditor
        topicId={params.topicId}
        existingNoteId={note?.id}
        initialContent={note?.content ?? `## Introduction\n\nWrite about "${topic?.title}" here.\n`}
        initialStatus={note?.status ?? "unwritten"}
      />
    </div>
  );
}