import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { HandoutView } from "@/components/HandoutView";
import { signTopicResourceUrls } from "@/lib/actions/topicResources";
import { EmptyState } from "@/components/EmptyState";

const TOPIC_LINK_MARKER_ID = /\[\[topic:([0-9a-fA-F-]{36})\]\]/g;

export default async function StudentTopicHandoutPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const resolvedParams = await params;
  const supabase = createClient();

  const { data: topic } = await supabase
    .from("curriculum_topics")
    .select("*, subjects(name)")
    .eq("id", resolvedParams.topicId)
    .single();

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

  if (!note) {
    return (
      <div className="max-w-2xl">
        <Link
          href={`/dashboard/student/topics/${topic.id}`}
          className="mb-4 inline-block text-sm text-leaf hover:underline print:hidden"
        >
          ← Back to note
        </Link>
        <p className="rounded-lg border border-rule bg-white p-4 text-sm text-ink-soft">
          Notes for this topic haven&apos;t been published yet.
        </p>
      </div>
    );
  }

  const { data: resources } = await supabase
    .from("topic_resources")
    .select("*")
    .eq("note_id", note.id)
    .order("sequence_order", { ascending: true });

  const displayResources = await signTopicResourceUrls(resources ?? []);

  const topicLinkIds = [...note.content.matchAll(TOPIC_LINK_MARKER_ID)].map((m) => m[1]);
  const { data: linkedTopics } =
    topicLinkIds.length > 0
      ? await supabase.from("curriculum_topics").select("id, title").in("id", topicLinkIds)
      : { data: [] };

  return (
    <div className="max-w-2xl">
      <Link
        href={`/dashboard/student/topics/${topic.id}`}
        className="mb-4 inline-block text-sm text-leaf hover:underline print:hidden"
      >
        ← Back to note
      </Link>

      <HandoutView
        content={note.content}
        resources={displayResources}
        topics={linkedTopics ?? []}
        topicMeta={{
          title: topic.title,
          subjectName: topic.subjects?.name,
          term: topic.term,
          weekNumber: topic.week_number,
          weekEndNumber: topic.week_end_number,
          educationLevel: topic.education_level,
          levelNumber: topic.level_number,
        }}
      />
    </div>
  );
}
