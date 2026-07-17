import Link from "next/link";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { markThreadRead } from "@/lib/actions/messages";
import { MessageComposer } from "@/components/MessageComposer";
import { RealtimeMessageThread } from "@/components/RealtimeMessageThread";
import { redirect } from "next/navigation";

export default async function MessageThreadPage({ params }: { params: { userId: string } }) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }
  const supabase = createClient();

  const { data: partner } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", params.userId)
    .single();

  const { data: messages } = await supabase
    .from("messages")
    .select("id, sender_id, content, sent_at")
    .or(
      `and(sender_id.eq.${profile.id},recipient_id.eq.${params.userId}),and(sender_id.eq.${params.userId},recipient_id.eq.${profile.id})`
    )
    .order("sent_at", { ascending: true });

  // Mark any unread messages from this partner as read now that the
  // thread is being viewed.
  await markThreadRead(params.userId);

  return (
    <div className="flex h-[calc(100vh-4rem)] max-w-xl flex-col">
      <div className="mb-4">
        <Link href="/dashboard/messages" className="text-sm text-leaf hover:underline">
          ← All messages
        </Link>
        <h1 className="mt-1 font-display text-2xl font-semibold text-ink">
          {partner?.full_name ?? "Unknown"}
        </h1>
        <p className="text-xs capitalize text-ink-soft">{partner?.role}</p>
      </div>

      <RealtimeMessageThread
        currentUserId={profile.id}
        partnerId={params.userId}
        initialMessages={messages ?? []}
      />

      <div className="mt-4">
        <MessageComposer recipientId={params.userId} />
      </div>
    </div>
  );
}
