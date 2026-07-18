"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";

export async function sendMessage(recipientId: string, content: string) {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error("You must be signed in to send messages.");
  }

  if (!content.trim()) {
    throw new Error("Message can't be empty.");
  }

  const supabase = createClient();

  const { error } = await supabase.from("messages").insert({
    sender_id: profile.id,
    recipient_id: recipientId,
    content: content.trim(),
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/messages/${recipientId}`);
  revalidatePath("/dashboard/messages");
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
 * Deletes every message between the current user and partnerId.
 * IMPORTANT: a message row is shared by both participants — there's no
 * per-user "hide for me" concept for messages themselves (that's what
 * archiving is for). This permanently removes the conversation for
 * both people, not just the caller.
 */
export async function deleteConversation(partnerId: string) {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error("You must be signed in.");
  }

  const supabase = createClient();

  const { error } = await supabase
    .from("messages")
    .delete()
    .or(
      `and(sender_id.eq.${profile.id},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${profile.id})`
    );

  if (error) throw new Error(error.message);

  // Clean up any archive record too, so a future conversation with the
  // same person doesn't start out pre-archived.
  await supabase
    .from("conversation_archives")
    .delete()
    .eq("user_id", profile.id)
    .eq("partner_id", partnerId);

  revalidatePath("/dashboard/messages");
}

/**
 * Archiving is per-viewer: it hides a conversation from your own inbox
 * without affecting the other participant or deleting anything. Messages
 * keep flowing and can still be read by opening the thread directly.
 */
export async function archiveConversation(partnerId: string) {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error("You must be signed in.");
  }

  const supabase = createClient();

  const { error } = await supabase
    .from("conversation_archives")
    .upsert({ user_id: profile.id, partner_id: partnerId });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/messages");
}

export async function unarchiveConversation(partnerId: string) {
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

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/messages");
}
