import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopicContent } from "@/components/TopicContent";
import { formatLevel } from "@/types/database";
import { createAdminClient } from "@/lib/supabase/admin";
import { EmptyState } from "@/components/EmptyState";
import { TOPIC_RESOURCE_BUCKET } from "@/lib/storageBuckets";

// Matches lib/tiptap/assessment-node.tsx's marker shape and
// TopicContent's own ASSESSMENT_MARKER regex -- kept in sync manually
// since this one runs server-side (to fetch the linked rows) while
// TopicContent's runs client-side (to place them in the rendered output).
const ASSESSMENT_MARKER_ID = /\[\[assessment:([0-9a-fA-F-]{36})\]\]/g;

export default async function TopicPage({ params }: { params: Promise<{ topicId: string }> }) {
  const resolvedParams = await params;

  const supabase = createClient();

  const { data: topic } = await supabase
    .from("curriculum_topics")
    .select("*, subjects(name)")
    .eq("id", resolvedParams.topicId)
    .single();

  // No row back means either the topic doesn't exist, or RLS correctly
  // denied it (e.g. a topic from another class/level). Either way, show
  // a clear message instead of silently rendering a blank page.
  if (!topic) {
    return (
      <div className="max-w-2xl">
        <Link
          href="/dashboard/student"
          className="mb-4 inline-block text-sm text-leaf hover:underline"
        >
          ← Back to my subjects
        </Link>
        <EmptyState message="This topic isn't available — it may not exist, or it may belong to a different class." />
      </div>
    );
  }

  const { data: note } = await supabase
    .from("topic_notes")
    .select("*")
    .eq("topic_id", resolvedParams.topicId)
    .eq("status", "published")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Scoped to the specific note version being displayed, not the whole
  // topic — topic_resources.note_id ties a resource to one note row, and
  // a topic can have several note versions over its history (drafts,
  // superseded published versions). Filtering by topic_id alone would
  // pull in resources attached to old, no-longer-displayed versions
  // alongside the current one — e.g. two "states of matter" diagrams
  // shown together after a note got revised and republished.
  const { data: resources } = note
    ? await supabase
        .from("topic_resources")
        .select("*")
        .eq("note_id", note.id)
        .order("sequence_order", { ascending: true })
    : { data: [] };

  const admin = createAdminClient();
  const displayResources = await Promise.all(
    (resources ?? []).map(async (resource) => {
      if (!resource.file_url || resource.file_url.startsWith("http")) return resource;
      const { data: signed } = await admin.storage
        .from(TOPIC_RESOURCE_BUCKET)
        .createSignedUrl(resource.file_url, 6 * 60 * 60);
      return { ...resource, file_url: signed?.signedUrl ?? null };
    })
  );

  const assessmentIds = [...(note?.content ?? "").matchAll(ASSESSMENT_MARKER_ID)].map((m) => m[1]);
  const { data: rawLinkedAssessments } =
    assessmentIds.length > 0
      ? await supabase
          .from("assessments")
          .select("id, title, assessment_type, quizzes(id)")
          .in("id", assessmentIds)
      : { data: [] };

  const linkedAssessments = (rawLinkedAssessments ?? []).map((a) => ({
    id: a.id,
    title: a.title,
    assessment_type: a.assessment_type,
    quizId: (Array.isArray(a.quizzes) ? a.quizzes[0] : a.quizzes)?.id,
  }));

  return (
    <div className="max-w-2xl">
      <Link
        href={`/dashboard/student/subjects/${topic.subject_id}`}
        className="mb-4 inline-block text-sm text-leaf hover:underline"
      >
        ← Back to {topic.subjects?.name ?? "subject"}
      </Link>

      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">{topic.title}</h1>
      <p className="mb-6 text-sm text-ink-soft">
        {topic.theme ? `${topic.theme} · ` : ""}Term {topic.term} ·{" "}
        {topic.week_end_number > topic.week_number
          ? `Weeks ${topic.week_number}–${topic.week_end_number}`
          : `Week ${topic.week_number}`}{" "}
        · {formatLevel(topic.education_level, topic.level_number)}
      </p>

      {note ? (
        <TopicContent
          content={note.content}
          resources={displayResources}
          linkedAssessments={linkedAssessments}
        />
      ) : (
        <p className="rounded-lg border border-rule bg-white p-4 text-sm text-ink-soft">
          Notes for this topic haven&apos;t been published yet.
        </p>
      )}
    </div>
  );
}
