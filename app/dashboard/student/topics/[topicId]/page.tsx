import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopicContent } from "@/components/TopicContent";
import { formatLevel } from "@/types/database";
import { signTopicResourceUrls } from "@/lib/actions/topicResources";
import { EmptyState } from "@/components/EmptyState";

// Matches lib/tiptap/assessment-node.tsx's marker shape and
// TopicContent's own ASSESSMENT_MARKER regex -- kept in sync manually
// since this one runs server-side (to fetch the linked rows) while
// TopicContent's runs client-side (to place them in the rendered output).
const ASSESSMENT_MARKER_ID = /\[\[assessment:([0-9a-fA-F-]{36})\]\]/g;

// Same "kept in sync manually" relationship to
// lib/tiptap/topic-link-node.tsx and TopicContent's TOPIC_LINK_MARKER.
const TOPIC_LINK_MARKER_ID = /\[\[topic:([0-9a-fA-F-]{36})\]\]/g;

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

  const displayResources = await signTopicResourceUrls(resources ?? []);

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

  // Same pattern as linkedAssessments above -- extract ids referenced in
  // this note's content, then fetch just those rows. RLS on
  // curriculum_topics already scopes what a student can see (see the
  // "may belong to a different class" comment above) -- a linked topic
  // outside that scope simply won't come back here, and TopicContent
  // silently drops any marker it can't resolve, same as a deleted/
  // inaccessible assessment.
  const topicLinkIds = [...(note?.content ?? "").matchAll(TOPIC_LINK_MARKER_ID)].map((m) => m[1]);
  const { data: linkedTopics } =
    topicLinkIds.length > 0
      ? await supabase.from("curriculum_topics").select("id, title").in("id", topicLinkIds)
      : { data: [] };

  return (
    <div className="max-w-2xl">
      <Link
        href={`/dashboard/student/subjects/${topic.subject_id}`}
        className="mb-4 inline-block text-sm text-leaf hover:underline"
      >
        ← Back to {topic.subjects?.name ?? "subject"}
      </Link>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mb-1 font-display text-2xl font-semibold text-ink">{topic.title}</h1>
          <p className="text-sm text-ink-soft">
            {topic.theme ? `${topic.theme} · ` : ""}Term {topic.term} ·{" "}
            {topic.week_end_number > topic.week_number
              ? `Weeks ${topic.week_number}–${topic.week_end_number}`
              : `Week ${topic.week_number}`}{" "}
            · {formatLevel(topic.education_level, topic.level_number)}
          </p>
        </div>
        {note && (
          <Link
            href={`/dashboard/student/topics/${topic.id}/handout`}
            className="inline-block shrink-0 rounded-lg border border-rule px-3 py-2 text-sm font-medium text-ink hover:bg-paper"
          >
            Print handout
          </Link>
        )}
      </div>

      {note ? (
        <TopicContent
          content={note.content}
          resources={displayResources}
          linkedAssessments={linkedAssessments}
          linkedTopics={linkedTopics ?? []}
        />
      ) : (
        <p className="rounded-lg border border-rule bg-white p-4 text-sm text-ink-soft">
          Notes for this topic haven&apos;t been published yet.
        </p>
      )}
    </div>
  );
}
