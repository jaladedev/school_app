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