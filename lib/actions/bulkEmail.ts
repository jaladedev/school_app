"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { assertRole } from "@/lib/actions/authGuards";
import { sendBulkEmail } from "@/lib/email";
import { writeAuditLog } from "@/lib/audit";
import DOMPurify from "isomorphic-dompurify";

export type BulkEmailAudienceRole = "student" | "parent" | "teacher" | "admin";

export type BulkEmailAudience = {
  roles: BulkEmailAudienceRole[];
  /** Only narrows the student/parent groups — teachers/admins aren't tied to a class. */
  classId?: string | null;
};

type Recipient = { id: string; email: string; fullName: string };

/**
 * Admin-only: this reaches every role in the school, unlike
 * assertCanManageFees's admin-or-bursar pattern. A bursar or any other
 * staff_role shouldn't be able to mass-email parents/students on their
 * own say-so.
 */
async function assertCanSendBulkEmail() {
  return assertRole(["admin"], "Only an admin can send bulk email.");
}

async function fetchRecipients(audience: BulkEmailAudience): Promise<Recipient[]> {
  const admin = createAdminClient();
  const byId = new Map<string, Recipient>();

  if (audience.roles.includes("student")) {
    let query = admin
      .from("student_profiles")
      .select("id, class_id, profiles!inner(full_name, is_active, profile_contacts(email))")
      .eq("profiles.is_active", true);
    if (audience.classId) {
      query = query.eq("class_id", audience.classId);
    }
    const { data } = await query;
    for (const row of data ?? []) {
      const email = row.profiles?.profile_contacts?.email;
      if (!email) continue;
      byId.set(row.id, { id: row.id, email, fullName: row.profiles!.full_name });
    }
  }

  if (audience.roles.includes("parent")) {
    let linksQuery = admin
      .from("guardian_links")
      .select(
        "parent_id, profiles!guardian_links_parent_id_fkey(full_name, is_active, profile_contacts(email)), student_profiles!inner(class_id)"
      );
    if (audience.classId) {
      linksQuery = linksQuery.eq("student_profiles.class_id", audience.classId);
    }
    const { data } = await linksQuery;
    for (const row of data ?? []) {
      const profile = row.profiles;
      const email = profile?.profile_contacts?.email;
      if (!profile?.is_active || !email) continue;
      byId.set(row.parent_id, { id: row.parent_id, email, fullName: profile.full_name });
    }
  }

  if (audience.roles.includes("teacher")) {
    const { data } = await admin
      .from("teacher_profiles")
      .select("id, profiles!inner(full_name, is_active, profile_contacts(email))")
      .eq("profiles.is_active", true);
    for (const row of data ?? []) {
      const email = row.profiles?.profile_contacts?.email;
      if (!email) continue;
      byId.set(row.id, { id: row.id, email, fullName: row.profiles!.full_name });
    }
  }

  if (audience.roles.includes("admin")) {
    const { data } = await admin
      .from("profiles")
      .select("id, full_name, is_active, profile_contacts(email)")
      .eq("role", "admin")
      .eq("is_active", true);
    for (const row of data ?? []) {
      const email = row.profile_contacts?.email;
      if (!email) continue;
      byId.set(row.id, { id: row.id, email, fullName: row.full_name });
    }
  }

  return Array.from(byId.values());
}

/** Lets the compose form show a live "N recipients" count before sending. */
export async function countBulkEmailRecipients(audience: BulkEmailAudience): Promise<number> {
  await assertCanSendBulkEmail();
  const recipients = await fetchRecipients(audience);
  return recipients.length;
}

export async function sendBulkEmailToAudience({
  audience,
  subject,
  body,
}: {
  audience: BulkEmailAudience;
  subject: string;
  /** Raw HTML from the compose form's rich text editor -- sanitized below before it ever reaches an email. */
  body: string;
}): Promise<{ sent: number; failed: number; recipientCount: number }> {
  const { id: actorId } = await assertCanSendBulkEmail();

  const trimmedSubject = subject.trim();
  // The editor leaves stray "<br>"/empty tags behind when "cleared" -- treat
  // that as empty rather than sending a blank-looking email.
  const bodyIsEmpty = body.replace(/<[^>]*>/g, "").trim() === "";
  if (!trimmedSubject) throw new Error("Enter a subject.");
  if (bodyIsEmpty) throw new Error("Enter a message body.");
  if (audience.roles.length === 0) throw new Error("Select at least one recipient group.");

  const recipients = await fetchRecipients(audience);
  if (recipients.length === 0) {
    throw new Error("No recipients match this selection (or none have an email on file).");
  }

  // The editor's contentEditable innerHTML is untrusted input (whatever the
  // browser let through, plus anything pasted) -- sanitize before it's ever
  // wrapped in an email, same as any other user-supplied HTML.
  const sanitizedBody = DOMPurify.sanitize(body);
  const html = `<div style="font-family: sans-serif;">${sanitizedBody}</div>`;
  const text = htmlToPlainText(sanitizedBody);

  const result = await sendBulkEmail({
    recipients: recipients.map((r) => ({ email: r.email, name: r.fullName })),
    subject: trimmedSubject,
    html,
    text,
  });

  await writeAuditLog({
    entityType: "bulk_email",
    entityId: actorId,
    action: "bulk_email_sent",
    actorId,
    metadata: {
      audience,
      subject: trimmedSubject,
      recipientCount: recipients.length,
      sent: result.sent,
      failed: result.failed.length,
    },
  });

  return { sent: result.sent, failed: result.failed.length, recipientCount: recipients.length };
}

/**
 * Derives the plain-text fallback email clients use when they can't (or
 * won't) render HTML. Block-level tags become line breaks and links show
 * their URL inline, since a stripped-tags version would otherwise glue
 * "Click hereTerm 2 resumes" into one unreadable line.
 */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<a\s+[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, "$2 ($1)")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
