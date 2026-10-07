import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopicContent } from "@/components/TopicContent";
import { LessonPlanReviewButtons } from "@/components/LessonPlanReviewButtons";
import { EmptyState } from "@/components/EmptyState";
import { signTopicResourceUrls } from "@/lib/actions/topicResources";
import { formatLevel } from "@/types/database";

/**
 * Admin-side read-only view of a single lesson plan note, with the
 * approve/reject buttons next to the content. The teacher notes route
 * (/dashboard/teacher/notes/[topicId]) is gated to the teacher role by its
 * layout, so linking admins there just bounced them back to their dashboard.
 */
export default async function AdminLessonPlanDetailPage({
  params,
}: {
  params: Promise<{ noteId: string }>;
}) {
  const { noteId } = await params;
  const supabase = createClient();

  const { data: note } = await supabase
    .from("topic_notes")
    .select(
      "id, topic_id, content, status, moderation_status, version, updated_at, profiles(full_name), curriculum_topics(title, theme, term, week_number, week_end_number, education_level, level_number, subjects(name))"
    )
    .eq("id", noteId)
    .maybeSingle();

  if (!note) {
    return (
      <div className="max-w-2xl">
        <Link
          href="/dashboard/admin/lesson-plans"
          className="mb-4 inline-block text-sm text-leaf hover:underline"
        >
          ← Lesson plan review
        </Link>
        <EmptyState message="This lesson plan couldn't be found." />
      </div>
    );
  }

  const topic = note.curriculum_topics;

  const { data: resources } = await supabase
    .from("topic_resources")
    .select("*")
    .eq("note_id", note.id)
    .order("sequence_order", { ascending: true });
  const displayResources = await signTopicResourceUrls(resources ?? []);

  return (
    <div className="max-w-2xl">
      <Link
        href="/dashboard/admin/lesson-plans"
        className="mb-4 inline-block text-sm text-leaf hover:underline"
      >
        ← Lesson plan review
      </Link>

      <div className="mb-6">
        <h1 className="mb-1 font-display text-2xl font-semibold text-ink">
          {topic?.title ?? "Untitled topic"}
        </h1>
        <p className="text-sm text-ink-soft">
          {topic?.subjects?.name ?? "Unknown subject"}
          {topic ? ` · ${formatLevel(topic.education_level, topic.level_number)}` : ""}
          {topic ? ` · Term ${topic.term}` : ""} · v{note.version}
          {note.profiles?.full_name ? ` · by ${note.profiles.full_name}` : ""}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {note.status !== "published" ? (
            <span className="rounded-full bg-paper px-2.5 py-1 text-xs text-ink-soft">
              Draft — not submitted for review
            </span>
          ) : note.moderation_status === "pending" ? (
            <LessonPlanReviewButtons noteId={note.id} />
          ) : (
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                note.moderation_status === "approved"
                  ? "bg-leaf-soft text-leaf"
                  : "bg-clay/10 text-clay"
              }`}
            >
              {note.moderation_status === "approved" ? "Approved" : "Rejected"}
            </span>
          )}
        </div>
      </div>

      <TopicContent
        content={note.content}
        resources={displayResources}
        linkedAssessments={[]}
        linkedTopics={[]}
      />
    </div>
  );
}
