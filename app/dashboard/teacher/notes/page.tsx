import Link from "next/link";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { formatLevel } from "@/types/database";
import { redirect } from "next/navigation";
import { Pagination, DEFAULT_PAGE_SIZE, parsePage, pageRange } from "@/components/Pagination";
import { LessonPlanReviewButtons } from "@/components/LessonPlanReviewButtons";

export default async function TeacherNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const resolvedSearchParams = await searchParams;

  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }
  const supabase = createClient();
  const page = parsePage(resolvedSearchParams.page);
  const { from, to } = pageRange(page, DEFAULT_PAGE_SIZE);

  const { data: teacherProfile } = await supabase
    .from("teacher_profiles")
    .select("subjects_taught, staff_role")
    .eq("id", profile.id)
    .single();

  const subjectIds = teacherProfile?.subjects_taught ?? [];

  const { data: settings } = await supabase
    .from("school_settings")
    .select("current_academic_year, current_term")
    .eq("id", 1)
    .single();

  const currentTerm = settings?.current_term ?? 1;
  const currentAcademicYear = settings?.current_academic_year ?? "";

  const { data: topics, count } = await supabase
    .from("curriculum_topics")
    .select("*, subjects(name)", { count: "exact" })
    .in("subject_id", subjectIds.length ? subjectIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("term", currentTerm)
    .eq("academic_year", currentAcademicYear)
    .order("name", { foreignTable: "subjects", ascending: true })
    .order("level_number", { ascending: true })
    .order("week_number", { ascending: true })
    .range(from, to);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / DEFAULT_PAGE_SIZE));

  const topicIds = (topics ?? []).map((t) => t.id);

  const { data: notes } = await supabase
    .from("topic_notes")
    .select("topic_id, status")
    .in("topic_id", topicIds.length ? topicIds : ["00000000-0000-0000-0000-000000000000"]);

  const statusByTopic = new Map((notes ?? []).map((n) => [n.topic_id, n.status]));

  // Lesson-plan review: a HOD sees the latest version of every published
  // note across their subjects that's still awaiting a decision. RLS
  // (topic_note_visible via is_hod_of_topic) already scopes this to only
  // their own subjects even if the query below were broader, but
  // filtering by subjectIds up front keeps the query itself tight.
  const isHod = teacherProfile?.staff_role === "hod";
  const { data: reviewCandidates } =
    isHod && subjectIds.length
      ? await supabase
          .from("topic_notes")
          .select(
            "id, topic_id, status, moderation_status, version, updated_at, curriculum_topics!inner(title, subject_id, subjects(name))"
          )
          .in("curriculum_topics.subject_id", subjectIds)
          .order("version", { ascending: false })
      : { data: [] };

  type ReviewCandidate = NonNullable<typeof reviewCandidates>[number];

  // Only the highest version per topic is the "current" one worth acting
  // on -- older superseded versions keep whatever moderation_status they
  // were left with and aren't actionable anymore.
  const latestByTopic = new Map<string, ReviewCandidate>();
  for (const note of reviewCandidates ?? []) {
    if (!latestByTopic.has(note.topic_id)) latestByTopic.set(note.topic_id, note);
  }
  const pendingReview = [...latestByTopic.values()].filter(
    (n) => n.status === "published" && n.moderation_status === "pending"
  );

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Curriculum notes</h1>
      <p className="mb-6 text-sm text-ink-soft">
        Author or edit notes for topics in the subjects you teach — Term {currentTerm}
        {currentAcademicYear ? ` · ${currentAcademicYear}` : ""}.
      </p>

      {isHod && (
        <section className="mb-6 rounded-xl border border-rule bg-white p-4">
          <h2 className="font-display text-lg font-semibold text-ink">
            Lesson plans awaiting your review
          </h2>
          <p className="mb-3 text-xs text-ink-soft">
            Published notes stay hidden from students and other staff until a HOD for that subject
            approves them.
          </p>
          {pendingReview.length ? (
            <div className="space-y-2">
              {pendingReview.map((note) => (
                <div
                  key={note.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-paper px-3 py-2"
                >
                  <div>
                    <Link
                      href={`/dashboard/teacher/notes/${note.topic_id}`}
                      className="text-sm font-medium text-ink hover:underline"
                    >
                      {note.curriculum_topics?.title}
                    </Link>
                    <p className="text-xs text-ink-soft">
                      {note.curriculum_topics?.subjects?.name} · v{note.version} ·{" "}
                      {new Date(note.updated_at).toLocaleString()}
                    </p>
                  </div>
                  <LessonPlanReviewButtons noteId={note.id} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-soft">Nothing waiting on you right now.</p>
          )}
        </section>
      )}

      <div className="space-y-2">
        {topics?.map((topic) => {
          const status = statusByTopic.get(topic.id) ?? "unwritten";
          const isUnwritten = status === "unwritten";
          return (
            <Link
              key={topic.id}
              href={`/dashboard/teacher/notes/${topic.id}`}
              className={`flex items-center justify-between rounded-lg border bg-white px-4 py-3 transition hover:border-leaf ${
                isUnwritten ? "border-dashed border-rule" : "border-rule"
              }`}
            >
              <div>
                <p className="text-ink">{topic.title}</p>
                <p className="text-xs text-ink-soft">
                  {topic.subjects?.name} · {formatLevel(topic.education_level, topic.level_number)}{" "}
                  ·{" "}
                  {topic.week_end_number > topic.week_number
                    ? `Weeks ${topic.week_number}–${topic.week_end_number}`
                    : `Week ${topic.week_number}`}
                  {topic.theme ? ` · ${topic.theme}` : ""}
                </p>
              </div>
              <span
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                  status === "published"
                    ? "bg-leaf-soft text-leaf"
                    : status === "draft"
                      ? "bg-marigold/20 text-marigold-dark"
                      : "bg-paper text-ink-soft"
                }`}
              >
                {isUnwritten ? (
                  <>
                    <span aria-hidden>+</span> Start writing
                  </>
                ) : (
                  status
                )}
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

      <Pagination basePath="/dashboard/teacher/notes" page={page} totalPages={totalPages} />
    </div>
  );
}
