import Link from "next/link";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { formatLevel } from "@/types/database";
import { redirect } from "next/navigation";
import { Pagination, DEFAULT_PAGE_SIZE, parsePage, pageRange } from "@/components/Pagination";

export default async function TeacherNotesPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }
  const supabase = createClient();
  const page = parsePage(searchParams.page);
  const { from, to } = pageRange(page, DEFAULT_PAGE_SIZE);

  const { data: teacherProfile } = await supabase
    .from("teacher_profiles")
    .select("subjects_taught")
    .eq("id", profile.id)
    .single();

  const subjectIds = teacherProfile?.subjects_taught ?? [];

  const { data: topics, count } = await supabase
    .from("curriculum_topics")
    .select("*, subjects(name)", { count: "exact" })
    .in("subject_id", subjectIds.length ? subjectIds : ["00000000-0000-0000-0000-000000000000"])
    .order("education_level", { ascending: true })
    .order("level_number", { ascending: true })
    .order("term", { ascending: true })
    .order("sequence_order", { ascending: true })
    .range(from, to);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / DEFAULT_PAGE_SIZE));

  const topicIds = (topics ?? []).map((t) => t.id);

  const { data: notes } = await supabase
    .from("topic_notes")
    .select("topic_id, status")
    .in("topic_id", topicIds.length ? topicIds : ["00000000-0000-0000-0000-000000000000"]);

  const statusByTopic = new Map((notes ?? []).map((n) => [n.topic_id, n.status]));

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">
        Curriculum notes
      </h1>
      <p className="mb-6 text-sm text-ink-soft">
        Author or edit notes for topics in the subjects you teach.
      </p>

      <div className="space-y-2">
        {topics?.map((topic) => {
          const status = statusByTopic.get(topic.id) ?? "unwritten";
          return (
            <Link
              key={topic.id}
              href={`/dashboard/teacher/notes/${topic.id}`}
              className="flex items-center justify-between rounded-lg border border-rule bg-white px-4 py-3 transition hover:border-leaf"
            >
              <div>
                <p className="text-ink">{topic.title}</p>
                <p className="text-xs text-ink-soft">
                  {topic.subjects?.name} ·{" "}
                  {formatLevel(topic.education_level, topic.level_number)} · Term{" "}
                  {topic.term}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  status === "published"
                    ? "bg-leaf-soft text-leaf"
                    : status === "draft"
                    ? "bg-marigold/20 text-marigold-dark"
                    : "bg-rule text-ink-soft"
                }`}
              >
                {status}
              </span>
            </Link>
          );
        })}

        {!topics?.length && (
          <p className="text-sm text-ink-soft">
            No subjects assigned yet — ask an admin to add subjects to your profile.
          </p>
        )}
      </div>

      <Pagination
        basePath="/dashboard/teacher/notes"
        page={page}
        totalPages={totalPages}
      />
    </div>
  );
}