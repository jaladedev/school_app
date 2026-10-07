import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopicContent } from "@/components/TopicContent";
import { LessonPlanReviewButtons } from "@/components/LessonPlanReviewButtons";
import { NoteVersionDiff } from "@/components/NoteVersionDiff";
import { EmptyState } from "@/components/EmptyState";
import { signTopicResourceUrls } from "@/lib/actions/topicResources";
import { formatLevel } from "@/types/database";

/**
 * HOD-side read-only view of a single lesson plan note, with approve/reject
 * next to the content and a "what changed" diff against earlier versions.
 * (/dashboard/teacher/notes/[topicId] is the author's editor -- a reviewer
 * shouldn't be dropped into an editable workspace to make a decision.)
 */
export default async function HodLessonPlanDetailPage({
  params,
}: {
  params: Promise<{ noteId: string }>;
}) {
  const { noteId } = await params;
  const supabase = createClient();

  const backLink = (
    <Link
      href="/dashboard/teacher/lesson-plans"
      className="mb-4 inline-block text-sm text-leaf hover:underline"
    >
      ← Lesson plan review
    </Link>
  );

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
        {backLink}
        <EmptyState message="This lesson plan couldn't be found." />
      </div>
    );
  }

  const topic = note.curriculum_topics;

  const [{ data: resources }, { data: versions }] = await Promise.all([
    supabase
      .from("topic_resources")
      .select("*")
      .eq("note_id", note.id)
      .order("sequence_order", { ascending: true }),
    supabase
      .from("topic_notes")
      .select("id, version, status, moderation_status, updated_at")
      .eq("topic_id", note.topic_id)
      .order("version", { ascending: false }),
  ]);
  const displayResources = await signTopicResourceUrls(resources ?? []);

  const latestVersion = versions?.[0]?.version ?? note.version;
  const isSuperseded = note.version < latestVersion;

  return (
    <div className="max-w-2xl">
      {backLink}

      <div className="mb-6">
        <h1 className="mb-1 font-display text-2xl font-semibold text-ink">
          {topic?.title ?? "Untitled topic"}
        </h1>
        <p className="text-sm text-ink-soft">
          {topic?.subjects?.name ?? "Unknown subject"}
          {topic ? ` · ${formatLevel(topic.education_level, topic.level_number)}` : ""}
          {topic ? ` · Term ${topic.term}` : ""}
          {topic
            ? topic.week_end_number > topic.week_number
              ? ` · Weeks ${topic.week_number}–${topic.week_end_number}`
              : ` · Week ${topic.week_number}`
            : ""}{" "}
          · v{note.version}
          {note.profiles?.full_name ? ` · by ${note.profiles.full_name}` : ""}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          {note.status !== "published" ? (
            <span className="rounded-full bg-paper px-2.5 py-1 text-xs text-ink-soft">
              Draft — not submitted for review
            </span>
          ) : isSuperseded ? (
            <span className="rounded-full bg-paper px-2.5 py-1 text-xs text-ink-soft">
              Superseded by v{latestVersion}
              {" · "}
              <Link
                href={`/dashboard/teacher/lesson-plans/${versions?.[0]?.id}`}
                className="text-leaf hover:underline"
              >
                open latest
              </Link>
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

      {versions && versions.length > 1 && (
        <section className="mt-8 rounded-xl border border-rule bg-white p-4">
          <h2 className="mb-2 font-display text-lg font-semibold text-ink">Version history</h2>
          <NoteVersionDiff versions={versions} />
        </section>
      )}
    </div>
  );
}
