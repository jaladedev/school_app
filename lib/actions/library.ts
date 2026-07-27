"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertRole } from "@/lib/actions/authGuards";
import { writeAuditLog } from "@/lib/audit";
import { computeInvoiceStatus } from "@/lib/invoiceStatus";

async function assertCanManageLibrary(): Promise<{ actorId: string }> {
  const { id } = await assertRole(
    ["admin", "teacher"],
    "Only an admin or librarian can manage the library."
  );
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", id).single();
  if (profile?.role === "admin") return { actorId: id };

  const { data: teacher } = await admin
    .from("teacher_profiles")
    .select("staff_role")
    .eq("id", id)
    .single();
  if (teacher?.staff_role !== "librarian") {
    throw new Error("Only an admin or librarian can manage the library.");
  }
  return { actorId: id };
}

// ---------- Catalog management ----------

export async function createLibraryBook(input: {
  title: string;
  author?: string;
  isbn?: string;
  category?: string;
  totalCopies: number;
}) {
  const { actorId } = await assertCanManageLibrary();
  if (!input.title.trim()) throw new Error("Title is required.");
  if (!Number.isInteger(input.totalCopies) || input.totalCopies < 1) {
    throw new Error("Total copies must be a whole number of at least 1.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("library_books")
    .insert({
      title: input.title.trim(),
      author: input.author?.trim() || null,
      isbn: input.isbn?.trim() || null,
      category: input.category?.trim() || null,
      total_copies: input.totalCopies,
      available_copies: input.totalCopies,
      created_by: actorId,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await writeAuditLog({
    entityType: "library_book",
    entityId: data.id,
    action: "library_book_created",
    actorId,
    metadata: { title: input.title, total_copies: input.totalCopies },
  });

  revalidatePath("/dashboard/library");
}

export async function updateLibraryBookCopies(bookId: string, totalCopies: number) {
  const { actorId } = await assertCanManageLibrary();
  if (!Number.isInteger(totalCopies) || totalCopies < 0) {
    throw new Error("Total copies must be a non-negative whole number.");
  }

  const admin = createAdminClient();
  const { data: book } = await admin
    .from("library_books")
    .select("total_copies, available_copies")
    .eq("id", bookId)
    .single();
  if (!book) throw new Error("Book not found.");

  const onLoan = book.total_copies - book.available_copies;
  if (totalCopies < onLoan) {
    throw new Error(`Can't set total copies below ${onLoan} — that many are currently on loan.`);
  }

  const { error } = await admin
    .from("library_books")
    .update({ total_copies: totalCopies, available_copies: totalCopies - onLoan })
    .eq("id", bookId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    entityType: "library_book",
    entityId: bookId,
    action: "library_book_copies_updated",
    actorId,
    metadata: { old_total_copies: book.total_copies, new_total_copies: totalCopies },
  });

  revalidatePath("/dashboard/library");
}

export async function archiveLibraryBook(bookId: string, archive: boolean) {
  const { actorId } = await assertCanManageLibrary();
  const admin = createAdminClient();

  const { error } = await admin
    .from("library_books")
    .update({ is_archived: archive })
    .eq("id", bookId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    entityType: "library_book",
    entityId: bookId,
    action: archive ? "library_book_archived" : "library_book_unarchived",
    actorId,
  });

  revalidatePath("/dashboard/library");
}

// ---------- Borrow / return ----------

export async function issueLibraryLoan(input: {
  bookId: string;
  studentId: string;
  dueAt: string;
}) {
  const { actorId } = await assertCanManageLibrary();
  const admin = createAdminClient();

  const { data: loan, error } = await admin.rpc("borrow_library_book", {
    p_book_id: input.bookId,
    p_student_id: input.studentId,
    p_due_at: input.dueAt,
  });

  if (error) throw new Error(error.message);

  await writeAuditLog({
    entityType: "library_loan",
    entityId: loan.id,
    action: "library_loan_issued",
    actorId,
    metadata: { book_id: input.bookId, student_id: input.studentId, due_at: input.dueAt },
  });

  revalidatePath("/dashboard/library");
  revalidatePath("/dashboard/library/loans");
  revalidatePath("/dashboard/student/library");
  revalidatePath("/dashboard/parent/library");
}

export async function returnLibraryLoan(loanId: string) {
  const { actorId } = await assertCanManageLibrary();
  const admin = createAdminClient();

  const { data: result, error } = await admin.rpc("return_library_book", { p_loan_id: loanId });
  if (error) throw new Error(error.message);
  const loan = result?.[0];
  if (!loan) throw new Error("Return could not be recorded.");

  await writeAuditLog({
    entityType: "library_loan",
    entityId: loanId,
    action: "library_loan_returned",
    actorId,
    metadata: {
      book_id: loan.book_id,
      student_id: loan.student_id,
      overdue_days: loan.overdue_days,
      fine_kobo: loan.fine_kobo,
    },
  });

  revalidatePath("/dashboard/library");
  revalidatePath("/dashboard/library/loans");
  revalidatePath("/dashboard/student/library");
  revalidatePath("/dashboard/parent/library");
  revalidatePath("/dashboard/admin/fees");
  revalidatePath("/dashboard/student/fees");
  revalidatePath("/dashboard/parent/fees");

  return { overdueDays: loan.overdue_days, fineKobo: loan.fine_kobo };
}

export async function waiveLibraryFine(invoiceId: string, reason?: string) {
  const { actorId } = await assertCanManageLibrary();
  const admin = createAdminClient();

  const { data: invoice } = await admin
    .from("invoices")
    .select("*, fee_structures(title)")
    .eq("id", invoiceId)
    .single();

  if (!invoice) throw new Error("Invoice not found.");

  // Scope check: this action only waives library fines, not arbitrary
  // invoices — an admin/librarian could otherwise use it as a backdoor
  // discount tool for regular fees.
  if (invoice.fee_structures?.title !== "Library Fine") {
    throw new Error("This isn't a library fine invoice.");
  }

  if (invoice.amount_paid_kobo > 0) {
    throw new Error(
      "This fine has already been paid — waiving isn't available here. Use the fees module to refund it if needed."
    );
  }

  const alreadyWaived = invoice.discount_kobo >= invoice.total_amount_kobo;
  if (alreadyWaived) {
    throw new Error("This fine has already been waived.");
  }

  if (invoice.voided_at) {
    throw new Error("This fine's invoice has been voided.");
  }

  const { error } = await admin
    .from("invoices")
    .update({
      discount_kobo: invoice.total_amount_kobo,
      status: computeInvoiceStatus(invoice.total_amount_kobo, invoice.total_amount_kobo, 0),
    })
    .eq("id", invoiceId);

  if (error) throw new Error(error.message);

  await writeAuditLog({
    entityType: "invoice",
    entityId: invoiceId,
    action: "library_fine_waived",
    actorId,
    metadata: {
      student_id: invoice.student_id,
      amount_kobo: invoice.total_amount_kobo,
      reason: reason || null,
    },
  });

  revalidatePath("/dashboard/library");
  revalidatePath("/dashboard/library/loans");
  revalidatePath("/dashboard/admin/fees");
  revalidatePath("/dashboard/admin/fees/invoices");
  revalidatePath("/dashboard/student/fees");
  revalidatePath("/dashboard/parent/fees");
}
