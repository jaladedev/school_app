import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateLibraryBookForm } from "@/components/CreateLibraryBookForm";
import { LibraryBookRow } from "@/components/LibraryBookRow";
import { EmptyState } from "@/components/EmptyState";

export default async function AdminLibraryPage() {
  const supabase = createClient();

  const { data: books } = await supabase
    .from("library_books")
    .select("*")
    .order("is_archived", { ascending: true })
    .order("title", { ascending: true });

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">Library Catalog</h1>
        <Link
          href="/dashboard/library/loans"
          className="text-sm font-medium text-leaf hover:underline"
        >
          Borrow / return →
        </Link>
      </div>
      <p className="mb-6 text-sm text-ink-soft">
        Manage the book catalog. Copy counts update automatically as books are borrowed and
        returned.
      </p>

      <CreateLibraryBookForm />

      <div className="space-y-2">
        {(books ?? []).map((book) => (
          <LibraryBookRow key={book.id} book={book} />
        ))}
        {!books?.length && <EmptyState message="No books in the catalog yet." />}
      </div>
    </div>
  );
}
