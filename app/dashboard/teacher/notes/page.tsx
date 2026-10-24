import Link from "next/link";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { formatLevel, type EducationLevel } from "@/types/database";
import { redirect } from "next/navigation";
import { Pagination, DEFAULT_PAGE_SIZE, parsePage, pageRange } from "@/components/Pagination";
import { LessonPlanReviewButtons } from "@/components/LessonPlanReviewButtons";

export default async function TeacherNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; class?: string; subject?: string }>;
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

  // Classes this teacher works with: the ones they are class teacher of plus
  // the ones on their timetable. Notes are shown one class at a time (a
  // class maps to an education level + level number, which is how curriculum
  // topics are keyed), optionally narrowed to a single subject.
  type ClassOption = {
    id: string;
    name: string;
    arm: string | null;
    education_level: EducationLevel;
    level_number: number;
  };
  const classOptions = new Map<string, ClassOption>();

  const { data: classTeacherOf } = await supabase
    .from("classes")
    .select("id, name, arm, education_level, level_number")
    .eq("class_teacher_id", profile.id)
    .eq("is_archived", false);
  for (const c of classTeacherOf ?? []) classOptions.set(c.id, c);

  const { data: timetableClasses } = await supabase
    .from("timetable_entries")
    .select("classes(id, name, arm, education_level, level_number, is_archived)")
    .eq("teacher_id", profile.id);
  for (const e of timetableClasses ?? []) {
    const c = e.classes;
    if (c && !c.is_archived && !classOptions.has(c.id)) classOptions.set(c.id, c);
  }

  const classList = [...classOptions.values()].sort(
    (a, b) => a.level_number - b.level_number || a.name.localeCompare(b.name)
  );
  const selectedClass =
    classList.find((c) => c.id === resolvedSearchParams.class) ?? classList[0] ?? null;

  const classLabel = (c: ClassOption) => `${c.name} ${c.arm ?? ""}`.trim();

  const baseTopicQuery = () => {
    let q = supabase
      .from("curriculum_topics")
      .select("*, subjects(name)", { count: "exact" })
      .in("subject_id", subjectIds.length ? subjectIds : ["00000000-0000-0000-0000-000000000000"])
      .eq("term", currentTerm)
      .eq("academic_year", currentAcademicYear);
    if (selectedClass) {
      q = q
        .eq("education_level", selectedClass.education_level)
        .eq("level_number", selectedClass.level_number);
    }
    return q;
  };

  // Subjects that actually have topics for this class, for the subject chips.
  const { data: subjectRows } = await baseTopicQuery().limit(1000);
  const subjectOptions = new Map<string, string>();
  for (const row of subjectRows ?? []) {
    if (row.subjects?.name) subjectOptions.set(row.subject_id, row.subjects.name);
  }
  const subjectList = [...subjectOptions.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const selectedSubjectId = subjectOptions.has(resolvedSearchParams.subject ?? "")
    ? (resolvedSearchParams.subject as string)
    : null;

  let topicQuery = baseTopicQuery();
  if (selectedSubjectId) topicQuery = topicQuery.eq("subject_id", selectedSubjectId);
  const { data: topics, count } = await topicQuery
    .order("name", { foreignTable: "subjects", ascending: true })
    .order("level_number", { ascending: true })
    .order("week_number", { ascending: true })
    .range(from, to);

  const filterHref = (cls: string | null, subject: string | null) => {
    const params = new URLSearchParams();
    if (cls) params.set("class", cls);
    if (subject) params.set("subject", subject);
    const qs = params.toString();
    return `/dashboard/teacher/notes${qs ? `?${qs}` : ""}`;
  };

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / DEFAULT_PAGE_SIZE));

  const topicIds = (topics ?? []).map((t) => t.id);

  const { data: notes } = await supabase
    .from("topic_notes")
    .select("topic_id, status")
    .in("topic_id", topicIds.length ? topicIds : ["00000000-0000-0000-0000-000000000000"]);

  const statusByTopic = new Map((notes ?? []).map((n) => [n.topic_id, n.status]));

  // Lesson-plan review: a HOD sees the latest version of every published note for every topic in the school, not just their own subjects_taught.
  const isHod = teacherProfile?.staff_role === "hod";
  const { data: reviewCandidates } = isHod
    ? await supabase
        .from("topic_notes")
        .select(
          "id, topic_id, status, moderation_status, version, updated_at, curriculum_topics!inner(title, subject_id, subjects(name))"
        )
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

      {classList.length > 0 && (
        <div className="mb-6 space-y-3">
          <div className="flex flex-wrap gap-2" aria-label="Class">
            {classList.map((c) => {
              const active = c.id === selectedClass?.id;
              return (
                <Link
                  key={c.id}
                  href={filterHref(c.id, null)}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    active
                      ? "border-leaf bg-leaf-soft font-medium text-leaf"
                      : "border-rule bg-white text-ink hover:border-leaf"
                  }`}
                >
                  {classLabel(c)}
                </Link>
              );
            })}
          </div>
          {subjectList.length > 0 && (
            <div className="flex flex-wrap gap-2" aria-label="Subject">
              <Link
                href={filterHref(selectedClass?.id ?? null, null)}
                aria-current={!selectedSubjectId ? "page" : undefined}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  !selectedSubjectId
                    ? "border-leaf bg-leaf-soft font-medium text-leaf"
                    : "border-rule bg-white text-ink-soft hover:border-leaf"
                }`}
              >
                All subjects
              </Link>
              {subjectList.map(([id, name]) => (
                <Link
                  key={id}
                  href={filterHref(selectedClass?.id ?? null, id)}
                  aria-current={id === selectedSubjectId ? "page" : undefined}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    id === selectedSubjectId
                      ? "border-leaf bg-leaf-soft font-medium text-leaf"
                      : "border-rule bg-white text-ink-soft hover:border-leaf"
                  }`}
                >
                  {name}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {isHod && (
        <section className="mb-6 rounded-xl border border-rule bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-ink">
              Lesson plans awaiting your review
            </h2>
            <Link
              href="/dashboard/teacher/lesson-plans"
              className="text-sm font-medium text-leaf hover:underline"
            >
              Open review queue →
            </Link>
          </div>
          <p className="mb-3 text-xs text-ink-soft">
            Published notes stay hidden from students and other staff until an Academic Head
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
                      href={`/dashboard/teacher/lesson-plans/${note.id}`}
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
                      ? "bg-marigold/20 text-marigold-text"
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

      <Pagination
        basePath="/dashboard/teacher/notes"
        page={page}
        totalPages={totalPages}
        searchParams={{
          class: selectedClass?.id,
          subject: selectedSubjectId ?? undefined,
        }}
      />
    </div>
  );
}
