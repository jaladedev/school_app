import Link from "next/link";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";

export default async function SubjectTopicsPage({
  params,
}: {
  params: { subjectId: string };
}) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }
  const supabase = createClient();

  const { data: studentProfile } = await supabase
    .from("student_profiles")
    .select("class_id")
    .eq("id", profile.id)
    .single();

  const { data: classRow } = await supabase
    .from("classes")
    .select("education_level, level_number")
    .eq("id", studentProfile?.class_id ?? "")
    .single();

  const { data: subject } = await supabase
    .from("subjects")
    .select("*")
    .eq("id", params.subjectId)
    .single();

  const { data: topics } = await supabase
    .from("curriculum_topics")
    .select("*")
    .eq("subject_id", params.subjectId)
    .eq("education_level", classRow?.education_level ?? "primary")
    .eq("level_number", classRow?.level_number ?? 0)
    .order("term", { ascending: true })
    .order("sequence_order", { ascending: true });

  const topicsByTerm = (topics ?? []).reduce<Record<number, typeof topics>>(
    (acc, topic) => {
      acc[topic.term] = [...(acc[topic.term] ?? []), topic];
      return acc;
    },
    {}
  );

  return (
    <div>
      <Link
        href="/dashboard/student"
        className="mb-2 inline-block text-sm text-leaf hover:underline"
      >
        ← My subjects
      </Link>
      <p className="mb-1 text-xs uppercase tracking-wide text-leaf">Subject</p>
      <h1 className="mb-6 font-display text-2xl font-semibold text-ink">
        {subject?.name}
      </h1>

      {Object.entries(topicsByTerm).map(([term, termTopics]) => (
        <div key={term} className="mb-8">
          <h2 className="mb-3 font-display text-lg font-semibold text-ink">
            Term {term}
          </h2>
          <ul className="space-y-2">
            {termTopics?.map((topic) => (
              <li key={topic.id}>
                <Link
                  href={`/dashboard/student/topics/${topic.id}`}
                  className="flex items-center justify-between rounded-lg border border-rule bg-white px-4 py-3 transition hover:border-leaf"
                >
                  <span className="text-ink">{topic.title}</span>
                  <span className="text-sm text-ink-soft">
                    {topic.sequence_order}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {!topics?.length && (
        <EmptyState message="No topics published yet." />
      )}
    </div>
  );
}