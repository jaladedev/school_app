import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopicContent } from "@/components/TopicContent";
import { formatLevel } from "@/types/database";

export default async function TopicPage({ params }: { params: { topicId: string } }) {
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
    .eq("status", "published")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: resources } = await supabase
    .from("topic_resources")
    .select("*")
    .eq("topic_id", params.topicId)
    .order("sequence_order", { ascending: true });

  return (
    <div className="max-w-2xl">
      <Link
        href={`/dashboard/student/subjects/${topic?.subject_id}`}
        className="mb-4 inline-block text-sm text-leaf hover:underline"
      >
        ← Back to {topic?.subjects?.name ?? "subject"}
      </Link>

      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">{topic?.title}</h1>
      <p className="mb-6 text-sm text-ink-soft">
        Term {topic?.term} · {topic && formatLevel(topic.education_level, topic.level_number)}
      </p>

      {note ? (
        <TopicContent content={note.content} resources={resources ?? []} />
      ) : (
        <p className="rounded-lg border border-rule bg-white p-4 text-sm text-ink-soft">
          Notes for this topic haven&apos;t been published yet.
        </p>
      )}
    </div>
  );
}
