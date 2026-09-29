"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getUnreadMessagesCount } from "@/lib/actions/messages";

/**
 * The sidebar's other badges (announcements, homework) come from
 * get_notification_counts(), fetched once when the dashboard layout
 * mounts. That's fine for those -- but Next.js doesn't re-run a
 * layout's server data fetch on a soft client-side navigation between
 * routes under it, so a message that arrives (or gets read) while the
 * user is already inside /dashboard never updates that count until a
 * hard reload. This subscribes to the same realtime channel the inbox
 * itself uses and re-fetches the true count on any change, so the nav
 * badge stays in sync with what the inbox list is already showing.
 */
export function LiveMessagesBadge({
  userId,
  initialCount,
}: {
  userId: string;
  initialCount: number;
}) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`nav-messages:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${userId}`,
        },
        async () => {
          const fresh = await getUnreadMessagesCount();
          setCount(fresh);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  if (!count) return null;
  return (
    <span className="ml-2 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-marigold px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}
