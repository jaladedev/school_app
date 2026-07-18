"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ArchiveConversationButton } from "@/components/ArchiveConversationButton";

type Conversation = {
  partnerId: string;
  partnerName: string;
  partnerRole: string;
  lastMessage: string;
  lastSentAt: string;
  unread: number;
  isArchived: boolean;
};

export function RealtimeInbox({
  currentUserId,
  initialConversations,
  view,
}: {
  currentUserId: string;
  initialConversations: Conversation[];
  view: "active" | "archived";
}) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const knownPartnerIds = useRef(new Set(initialConversations.map((c) => c.partnerId)));
  // A brand new message always belongs to an unarchived conversation, so
  // it should only ever be live-injected while looking at the Active
  // tab. Archived conversations stay put until the page is reloaded,
  // matching how most inboxes treat muted/archived threads.
  const isActiveView = view === "active";

  useEffect(() => {
    setConversations(initialConversations);
    knownPartnerIds.current = new Set(initialConversations.map((c) => c.partnerId));
  }, [initialConversations]);

  useEffect(() => {
    if (!isActiveView) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`messages:inbox:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${currentUserId}`,
        },
        async (payload) => {
          const row = payload.new as {
            id: string;
            sender_id: string;
            content: string;
            sent_at: string;
          };

          setConversations((prev) => {
            const existing = prev.find((c) => c.partnerId === row.sender_id);
            if (existing) {
              const updated = prev.map((c) =>
                c.partnerId === row.sender_id
                  ? {
                      ...c,
                      lastMessage: row.content,
                      lastSentAt: row.sent_at,
                      unread: c.unread + 1,
                    }
                  : c
              );
              return updated.sort(
                (a, b) => new Date(b.lastSentAt).getTime() - new Date(a.lastSentAt).getTime()
              );
            }
            return prev;
          });

          // Brand new conversation partner we haven't seen before — fetch
          // their profile so we can show a real name instead of skipping
          // the notification entirely.
          if (!knownPartnerIds.current.has(row.sender_id)) {
            knownPartnerIds.current.add(row.sender_id);

            const { data: partner } = await supabase
              .from("profiles")
              .select("full_name, role")
              .eq("id", row.sender_id)
              .single();

            setConversations((prev) => {
              if (prev.some((c) => c.partnerId === row.sender_id)) return prev;
              const next: Conversation = {
                partnerId: row.sender_id,
                partnerName: partner?.full_name ?? "Unknown",
                partnerRole: partner?.role ?? "",
                lastMessage: row.content,
                lastSentAt: row.sent_at,
                unread: 1,
                isArchived: false,
              };
              return [next, ...prev].sort(
                (a, b) => new Date(b.lastSentAt).getTime() - new Date(a.lastSentAt).getTime()
              );
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, isActiveView]);

  return (
    <div className="space-y-2">
      {conversations.map((convo) => (
        <div
          key={convo.partnerId}
          className="flex items-center justify-between rounded-lg border border-rule bg-white px-4 py-3 transition hover:border-leaf"
        >
          <Link href={`/dashboard/messages/${convo.partnerId}`} className="min-w-0 flex-1">
            <p className="font-medium text-ink">{convo.partnerName}</p>
            <p className="truncate text-sm text-ink-soft">{convo.lastMessage}</p>
          </Link>
          <div className="ml-3 flex items-center gap-3">
            {convo.unread > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-marigold px-1.5 text-xs font-medium text-ink">
                {convo.unread}
              </span>
            )}
            <ArchiveConversationButton partnerId={convo.partnerId} isArchived={convo.isArchived} />
          </div>
        </div>
      ))}

      {!conversations.length && <p className="text-sm text-ink-soft">No conversations yet.</p>}
    </div>
  );
}
