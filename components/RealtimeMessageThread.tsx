"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { markThreadRead } from "@/lib/actions/messages";

type Message = {
  id: string;
  sender_id: string;
  content: string;
  sent_at: string;
};

export function RealtimeMessageThread({
  currentUserId,
  partnerId,
  initialMessages,
}: {
  currentUserId: string;
  partnerId: string;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const bottomRef = useRef<HTMLDivElement>(null);
  const seenIds = useRef(new Set(initialMessages.map((m) => m.id)));

  // Keep in sync if the server component re-renders with a fresh initial
  // list (e.g. after a full navigation), without duplicating anything
  // the realtime subscription already appended in the meantime.
  useEffect(() => {
    setMessages(initialMessages);
    seenIds.current = new Set(initialMessages.map((m) => m.id));
  }, [initialMessages]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`messages:thread:${currentUserId}:${partnerId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${currentUserId}`,
        },
        (payload) => {
          const row = payload.new as Message & { sender_id: string };
          // The filter above catches every message sent *to* me, from
          // anyone — only append it here if it's actually from the
          // person this thread is with.
          if (row.sender_id !== partnerId) return;
          if (seenIds.current.has(row.id)) return;

          seenIds.current.add(row.id);
          setMessages((prev) => [
            ...prev,
            { id: row.id, sender_id: row.sender_id, content: row.content, sent_at: row.sent_at },
          ]);

          // Mark it read immediately since the thread is open and being
          // viewed right now.
          markThreadRead(partnerId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, partnerId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="flex-1 space-y-2 overflow-y-auto rounded-lg border border-rule bg-white p-4">
      {messages.map((m) => {
        const isMine = m.sender_id === currentUserId;
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

      {!messages.length && (
        <p className="text-center text-sm text-ink-soft">No messages yet — say hello.</p>
      )}
      <div ref={bottomRef} />
    </div>
  );
}