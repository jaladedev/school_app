import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import { isLoanOverdue } from "@/types/database";

export default async function StudentLibraryPage() {
  const profile = await getCurrentProfile();
  const supabase = createClient();

  const { data: loans } = await supabase
    .from("library_loans")
    .select("*, library_books(title, author)")
    .eq("student_id", profile?.id ?? "")
    .order("borrowed_at", { ascending: false });

  const active = (loans ?? []).filter((l) => !l.returned_at);
  const past = (loans ?? []).filter((l) => l.returned_at);

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">My Library</h1>
      <p className="mb-6 text-sm text-ink-soft">Books currently borrowed and your loan history.</p>

      <h2 className="mb-2 font-display text-lg font-semibold text-ink">Currently borrowed</h2>
      <div className="mb-6 space-y-2">
        {active.map((loan) => {
          const overdue = isLoanOverdue(loan);
          return (
            <div
              key={loan.id}
              className={`rounded-lg border bg-white px-4 py-3 ${overdue ? "border-clay" : "border-rule"}`}
            >
              <p className="font-medium text-ink">{loan.library_books?.title}</p>
              <p className="text-xs text-ink-soft">
                {loan.library_books?.author && `${loan.library_books.author} · `}
                Due{" "}
                {new Date(loan.due_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                {overdue && <span className="ml-1 font-medium text-clay">· Overdue</span>}
              </p>
            </div>
          );
        })}
        {!active.length && <EmptyState message="No books currently borrowed." />}
      </div>

      {past.length > 0 && (
        <>
          <h2 className="mb-2 font-display text-lg font-semibold text-ink">Past loans</h2>
          <div className="space-y-2">
            {past.map((loan) => (
              <div key={loan.id} className="rounded-lg border border-rule bg-white px-4 py-3">
                <p className="font-medium text-ink">{loan.library_books?.title}</p>
                <p className="text-xs text-ink-soft">
                  Returned{" "}
                  {loan.returned_at &&
                    new Date(loan.returned_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
