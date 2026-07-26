"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TRIP_STATUS_LABELS, type TripStatusValue } from "@/types/database";

const STATUS_STYLES: Record<TripStatusValue, string> = {
  not_started: "bg-paper text-ink-soft",
  en_route: "bg-marigold-soft text-ink",
  arrived: "bg-leaf-soft text-leaf",
};

export function TransportStatusBadge({
  routeId,
  tripDate,
  direction,
  initialStatus,
}: {
  routeId: string;
  tripDate: string;
  direction: "morning" | "afternoon";
  initialStatus: TripStatusValue;
}) {
  const [status, setStatus] = useState<TripStatusValue>(initialStatus);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`transport:${routeId}:${tripDate}:${direction}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transport_trip_status",
          filter: `route_id=eq.${routeId}`,
        },
        (payload) => {
          const row = payload.new as {
            trip_date: string;
            direction: string;
            status: TripStatusValue;
          };
          if (row.trip_date !== tripDate || row.direction !== direction) return;
          setStatus(row.status);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [routeId, tripDate, direction]);

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {TRIP_STATUS_LABELS[status]}
    </span>
  );
}
