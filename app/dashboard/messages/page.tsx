import Link from "next/link";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { NewConversationSearch } from "@/components/NewConversationSearch";
import { RealtimeInbox } from "@/components/RealtimeInbox";
import { redirect } from "next/navigation";

export default async function MessagesInboxPage({
  searchParams,
}: {
  searchParams: { view?: string };
}) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }
  const supabase = createClient();
  const view = searchParams.view === "archived" ? "archived" : "active";

  const { data: messages } = await supabase
    .from("messages")
    .select("id, sender_id, recipient_id, content, read, sent_at")
    .or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
    .order("sent_at", { ascending: false });

  const { data: archives } = await supabase
    .from("conversation_archives")
    .select("partner_id")
    .eq("user_id", profile.id);

  const archivedPartnerIds = new Set((archives ?? []).map((a) => a.partner_id));

  // Group into one row per conversation partner, keeping the most
  // recent message and counting unread messages FROM that partner.
  const conversations = new Map<
    string,
    { lastMessage: string; lastSentAt: string; unread: number }
  >();

  for (const m of messages ?? []) {
    const partnerId = m.sender_id === profile.id ? m.recipient_id : m.sender_id;
    if (!conversations.has(partnerId)) {
      conversations.set(partnerId, { lastMessage: m.content, lastSentAt: m.sent_at, unread: 0 });
    }
    if (m.recipient_id === profile.id && !m.read) {
      conversations.get(partnerId)!.unread += 1;
    }
  }

  const partnerIds = [...conversations.keys()];
  const { data: partners } = partnerIds.length
    ? await supabase.from("profiles").select("id, full_name, role").in("id", partnerIds)
    : { data: [] };

  const partnerById = new Map((partners ?? []).map((p) => [p.id, p]));

  const archivedCount = partnerIds.filter((id) => archivedPartnerIds.has(id)).length;

  const sortedConversations = [...conversations.entries()]
    .filter(([partnerId]) =>
      view === "archived" ? archivedPartnerIds.has(partnerId) : !archivedPartnerIds.has(partnerId)
    )
    .sort((a, b) => new Date(b[1].lastSentAt).getTime() - new Date(a[1].lastSentAt).getTime())
    .map(([partnerId, convo]) => ({
      partnerId,
      partnerName: partnerById.get(partnerId)?.full_name ?? "Unknown",
      partnerRole: partnerById.get(partnerId)?.role ?? "",
      lastMessage: convo.lastMessage,
      lastSentAt: convo.lastSentAt,
      unread: convo.unread,
      isArchived: archivedPartnerIds.has(partnerId),
    }));

  return (
    <div className="max-w-xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">Messages</h1>
        <NewConversationSearch currentUserId={profile.id} />
      </div>

      <div className="mb-4 flex gap-2">
        <Link
          href="/dashboard/messages"
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
            view === "active" ? "border-leaf bg-leaf-soft text-leaf" : "border-rule text-ink-soft"
          }`}
        >
          Active
        </Link>
        <Link
          href="/dashboard/messages?view=archived"
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
            view === "archived" ? "border-leaf bg-leaf-soft text-leaf" : "border-rule text-ink-soft"
          }`}
        >
          Archived{archivedCount > 0 ? ` (${archivedCount})` : ""}
        </Link>
      </div>

      <RealtimeInbox
        currentUserId={profile.id}
        initialConversations={sortedConversations}
        view={view}
      />
    </div>
  );
}
