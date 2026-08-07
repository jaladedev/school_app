import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { HandoutView } from "@/components/HandoutView";
import { createAdminClient } from "@/lib/supabase/admin";
import { EmptyState } from "@/components/EmptyState";
import { TOPIC_RESOURCE_BUCKET } from "@/lib/storageBuckets";

// Same manual-sync relationship to lib/tiptap/topic-link-node.tsx as the
// main topic page -- see the comment there for why this can't just be
// imported/shared directly (this one runs server-side to fetch the
// linked rows, the client-side counterpart runs to place them in the
// rendered output). Note there's no assessment-marker equivalent here:
// a "Start quiz" link is meaningless on a printed page, so this handout
// deliberately doesn't resolve `[[assessment:...]]` markers at all --
// TopicContent silently drops any marker it can't resolve, so those
// chips just don't appear in the printout rather than rendering a dead
// link.
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
