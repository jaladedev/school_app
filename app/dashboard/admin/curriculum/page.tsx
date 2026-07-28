import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateTopicForm } from "@/components/CreateTopicForm";
import { TopicRow } from "@/components/TopicRow";
import { EmptyState } from "@/components/EmptyState";
import { formatLevel } from "@/types/database";

export default async function AdminCurriculumPage({
  searchParams,
}: {
  searchParams: Promise<{ subjectId?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const supabase = createClient();

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name, education_level, min_level_number, max_level_number")
    .order("education_level", { ascending: true })
    .order("name", { ascending: true });

  const { data: settings } = await supabase
    .from("school_settings")
    .select("current_academic_year, current_term")
    .eq("id", 1)
    .single();

  const activeSubjectId = resolvedSearchParams.subjectId || subjects?.[0]?.id;
  const activeSubject = subjects?.find((s) => s.id === activeSubjectId);

  const { data: topics } = activeSubjectId
    ? await supabase
        .from("curriculum_topics")
        .select("*")
        .eq("subject_id", activeSubjectId)
        .order("level_number", { ascending: true })
        .order("term", { ascending: true })
        .order("sequence_order", { ascending: true })
    : { data: [] };

  // Grouped by level+term so the scheme of work reads like an actual
  // term-by-term plan rather than one flat list.
  const grouped = new Map<string, typeof topics>();
  for (const topic of topics ?? []) {
    const key = `${topic.level_number}|${topic.term}`;
    grouped.set(key, [...(grouped.get(key) ?? []), topic]);
  }
  const groupKeys = Array.from(grouped.keys()).sort((a, b) => {
    const [aLevel, aTerm] = a.split("|").map(Number);
    const [bLevel, bTerm] = b.split("|").map(Number);
    return aLevel - bLevel || aTerm - bTerm;
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Scheme of Work</h1>
        <p className="text-sm text-ink-soft">
          Plan curriculum topics by subject, level, term, and week.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {subjects?.map((s) => (
          <Link
            key={s.id}
            href={`/dashboard/admin/curriculum?subjectId=${s.id}`}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
              s.id === activeSubjectId
                ? "border-leaf bg-leaf-soft text-leaf"
                : "border-rule text-ink-soft hover:border-leaf"
            }`}
          >
            {s.name}
          </Link>
        ))}
      </div>

      {!subjects?.length && (
        <EmptyState
          message="No subjects created yet."
          action={{ label: "Go to Subjects", href: "/dashboard/admin/subjects" }}
        />
      )}

      {activeSubject && (
        <>
          <CreateTopicForm
            subjects={[activeSubject]}
            defaultAcademicYear={settings?.current_academic_year ?? ""}
            defaultTerm={settings?.current_term ?? 1}
            existingTopics={topics ?? []}
          />

          {groupKeys.length === 0 && (
            <EmptyState message={`No topics yet for ${activeSubject.name}.`} />
          )}

          {groupKeys.map((key) => {
            const [levelNumber, term] = key.split("|").map(Number);
            const rows = grouped.get(key) ?? [];
            return (
              <div key={key} className="mb-8">
                <h2 className="mb-3 font-display text-lg font-semibold text-ink">
                  {formatLevel(activeSubject.education_level, levelNumber)} · Term {term}
                </h2>
                <div className="space-y-2">
                  {rows.map((topic) => (
                    <TopicRow
                      key={topic.id}
                      topic={topic}
                      subjectName={activeSubject.name}
                      minLevel={activeSubject.min_level_number}
                      maxLevel={activeSubject.max_level_number}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
