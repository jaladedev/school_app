"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit";
import { throwDbError } from "@/lib/errors/db";
import { runAction } from "@/lib/actionResult";

/**
 * Returns just the display name/role for a message-thread partner.
 * profiles' own RLS only lets a caller read their own row (or, for
 * admins/teachers, everyone) -- so a student or parent opening a thread
 * with a teacher they found via search_messageable_users has no
 * row-level access to that teacher's profile via the plain session
 * client. Needs the admin client to bypass that, same reasoning as the
 * search RPC: only full_name/role ever come back, nothing more
 * sensitive, so this isn't widening access beyond what starting the
 * conversation already exposed.
 */
export async function getMessagePartner(
  userId: string
): Promise<{ full_name: string; role: string } | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("full_name, role")
    .eq("id", userId)
    .maybeSingle();
  return data;
}

/**
 * Bulk version of getMessagePartner, for the inbox list where a student
 * or parent may have several conversations with teachers/admins whose
 * profiles rows their own session can't read (same RLS gap noted
 * above). Returns a plain array rather than a Map since server actions
 * can only return plain serializable data across the client/server
 * boundary.
 */
export async function getMessagePartners(
  userIds: string[]
): Promise<{ id: string; full_name: string; role: string }[]> {
  if (!userIds.length) return [];
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("id, full_name, role").in("id", userIds);
  return data ?? [];
}

export async function sendMessage(recipientId: string, content: string) {
  return runAction(async () => {
    const profile = await getCurrentProfile();
    if (!profile) {
      throw new Error("You must be signed in to send messages.");
    }

    if (!content.trim()) {
      throw new Error("Message can't be empty.");
    }

    const supabase = createClient();

    // Same RLS gap as getMessagePartner above: a student/parent sending to
    // a teacher has no row-level access to that teacher's profiles row via
    // the session client, so this existence/active check needs the admin
    // client too -- it only ever reads id/is_active, never anything more
    // sensitive, so it's exposing nothing beyond "does this id exist and
    // is it active", which messages_insert_sender already implies anyone
    // may need to know before sending.
    const admin = createAdminClient();
    const { data: recipient, error: recipientError } = await admin
      .from("profiles")
      .select("id, is_active")
      .eq("id", recipientId)
      .maybeSingle();

    if (recipientError || !recipient) {
      throw new Error("Recipient not found.");
    }

    if (recipient.id === profile.id) {
      throw new Error("You can't message yourself.");
    }

    if (!recipient.is_active) {
      throw new Error("That account is no longer active.");
    }

    const { error } = await supabase.from("messages").insert({
      sender_id: profile.id,
      recipient_id: recipientId,
      content: content.trim(),
    });

    if (error) throwDbError(error);

    revalidatePath(`/dashboard/messages/${recipientId}`);
    revalidatePath("/dashboard/messages");
  });
}

export async function markThreadRead(partnerId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const supabase = createClient();

  await supabase
    .from("messages")
    .update({ read: true })
    .eq("recipient_id", profile.id)
    .eq("sender_id", partnerId)
    .eq("read", false);

  revalidatePath("/dashboard/messages");
}

/**
 * Backs the live sidebar badge (LiveMessagesBadge) rather than
 * get_notification_counts(): that RPC only runs once per dashboard
 * *layout* mount, and Next.js doesn't re-run a layout's server data on
 * a soft client-side navigation between routes under it -- so the
 * badge would otherwise go stale the moment a new message arrives
 * while the user is already inside /dashboard. Scoped to the caller's
 * own recipient_id, so the plain session client (and its RLS) is fine
 * here -- no admin client needed, unlike the partner-lookup actions
 * above.
 */
export async function getUnreadMessagesCount(): Promise<number> {
  const profile = await getCurrentProfile();
  if (!profile) return 0;

  const supabase = createClient();
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", profile.id)
    .eq("read", false);

  return count ?? 0;
}

/**
 * Deletes every message between the current user and partnerId.
 * IMPORTANT: a message row is shared by both participants — there's no
 * per-user "hide for me" concept for messages themselves (that's what
 * archiving is for). This permanently removes the conversation for
 * both people, not just the caller.
 *
 * The deletion is audit-logged so admins can see who wiped what and
 * approximately how many messages were removed — no data recovery, but
 * at least there's a trace if a dispute arises later.
 */
export async function deleteConversation(partnerId: string) {
  return runAction(async () => {
    const profile = await getCurrentProfile();
    if (!profile) {
      throw new Error("You must be signed in.");
    }

    const supabase = createClient();

    // Count messages before deleting so the audit entry is useful
    const { count: messageCount } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .or(
        `and(sender_id.eq.${profile.id},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${profile.id})`
      );

    const { error } = await supabase
      .from("messages")
      .delete()
      .or(
        `and(sender_id.eq.${profile.id},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${profile.id})`
      );

    if (error) throwDbError(error);

    // Clean up any archive record too, so a future conversation with the
    // same person doesn't start out pre-archived.
    await supabase
      .from("conversation_archives")
      .delete()
      .eq("user_id", profile.id)
      .eq("partner_id", partnerId);

    // Best-effort audit trail — deletion affects both parties so admins
    // can investigate if the other participant reports missing messages.
    await writeAuditLog({
      entityType: "conversation",
      entityId: profile.id,
      action: "conversation_deleted",
      actorId: profile.id,
      metadata: {
        deleted_by: profile.id,
        partner_id: partnerId,
        message_count: messageCount ?? 0,
      },
    });

    revalidatePath("/dashboard/messages");
  });
}

/**
 * Archiving is per-viewer: it hides a conversation from your own inbox
 * without affecting the other participant or deleting anything. Messages
 * keep flowing and can still be read by opening the thread directly.
 */
export async function archiveConversation(partnerId: string) {
  return runAction(async () => {
    const profile = await getCurrentProfile();
    if (!profile) {
      throw new Error("You must be signed in.");
    }

    const supabase = createClient();

    const { error } = await supabase
      .from("conversation_archives")
      .upsert({ user_id: profile.id, partner_id: partnerId });

    if (error) throwDbError(error);

    revalidatePath("/dashboard/messages");
  });
}

export async function unarchiveConversation(partnerId: string) {
  return runAction(async () => {
    const profile = await getCurrentProfile();
    if (!profile) {
      throw new Error("You must be signed in.");
    }

    const supabase = createClient();

    const { error } = await supabase
      .from("conversation_archives")
      .delete()
      .eq("user_id", profile.id)
      .eq("partner_id", partnerId);

    if (error) throwDbError(error);

    revalidatePath("/dashboard/messages");
  });
}
