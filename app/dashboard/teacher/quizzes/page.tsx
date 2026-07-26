import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";

export default async function TeacherQuizzesPage() {
  const supabase = createClient();

  const { data: quizzes } = await supabase
    .from("quizzes")
    .select("id, is_published, duration_minutes, assessments(title, term, academic_year)")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Quizzes</h1>
          <p className="text-sm text-ink-soft">Timed, auto-graded CBTs.</p>
        </div>
        <Link
          href="/dashboard/teacher/quizzes/new"
          className="rounded-lg bg-marigold px-4 py-2 text-sm font-medium text-ink hover:bg-marigold-dark"
        >
          + New quiz
        </Link>
      </div>

      <div className="space-y-2">
        {(quizzes ?? []).map((q) => (
          <Link
            key={q.id}
            href={`/dashboard/teacher/quizzes/${q.id}`}
            className="flex items-center justify-between rounded-lg border border-rule bg-white p-3 text-sm hover:bg-leaf-soft"
          >
            <div>
              <p className="font-medium text-ink">{q.assessments?.title}</p>
              <p className="text-xs text-ink-soft">
                {q.assessments?.term && `Term ${q.assessments.term}`} ·{" "}
                {q.assessments?.academic_year} · {q.duration_minutes} min
              </p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                q.is_published ? "bg-leaf-soft text-leaf" : "bg-paper text-ink-soft"
              }`}
            >
              {q.is_published ? "Published" : "Draft"}
            </span>
          </Link>
        ))}
        {!quizzes?.length && <EmptyState message="No quizzes yet — create the first one above." />}
      </div>
    </div>
  );
}
