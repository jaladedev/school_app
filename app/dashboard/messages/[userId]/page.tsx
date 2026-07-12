import Link from "next/link";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { markThreadRead } from "@/lib/actions/messages";
import { MessageComposer } from "@/components/MessageComposer";

export default async function MessageThreadPage({
  params,
}: {
  params: { userId: string };
}) {
  const profile = await getCurrentProfile();
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
      `and(sender_id.eq.${profile!.id},recipient_id.eq.${params.userId}),and(sender_id.eq.${params.userId},recipient_id.eq.${profile!.id})`
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

      <div className="flex-1 space-y-2 overflow-y-auto rounded-lg border border-rule bg-white p-4">
        {messages?.map((m) => {
          const isMine = m.sender_id === profile!.id;
          return (
            <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                  isMine ? "bg-marigold text-ink" : "bg-paper text-ink"
                }`}
              >
                <p>{m.content}</p>
                <p className="mt-1 text-[10px] text-ink-soft">
                  {new Date(m.sent_at).toLocaleString()}
                </p>
              </div>
            </div>
          );
        })}

        {!messages?.length && (
          <p className="text-center text-sm text-ink-soft">
            No messages yet — say hello.
          </p>
        )}
      </div>

      <div className="mt-4">
        <MessageComposer recipientId={params.userId} />
      </div>
    </div>
  );
}