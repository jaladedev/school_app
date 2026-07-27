"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import type { TripDirection } from "@/types/database";

const RouteMapInner = dynamic(
  () => import("@/components/RouteMapInner").then((m) => m.RouteMapInner),
  { ssr: false }
);

export function RouteMap({
  routeId,
  tripDate,
  direction,
  initialLat,
  initialLng,
  initialRecordedAt,
  label,
}: {
  routeId: string;
  tripDate: string;
  direction: TripDirection;
  initialLat: number | null;
  initialLng: number | null;
  initialRecordedAt: string | null;
  label: string;
}) {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(
    initialLat !== null && initialLng !== null ? { lat: initialLat, lng: initialLng } : null
  );
  const [recordedAt, setRecordedAt] = useState(initialRecordedAt);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`transport-location:${routeId}:${tripDate}:${direction}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "transport_locations",
          filter: `route_id=eq.${routeId}`,
        },
        (payload) => {
          const row = payload.new as {
            trip_date: string;
            direction: string;
            lat: number;
            lng: number;
            recorded_at: string;
          };
          if (row.trip_date !== tripDate || row.direction !== direction) return;
          setPosition({ lat: row.lat, lng: row.lng });
          setRecordedAt(row.recorded_at);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [routeId, tripDate, direction]);

  if (!position) {
    return (
      <p className="rounded-xl border border-rule bg-paper p-4 text-sm text-ink-soft">
        No live location yet for this trip.
      </p>
    );
  }

  return (
    <div>
      <RouteMapInner lat={position.lat} lng={position.lng} label={label} />
      {recordedAt && (
        <p className="mt-1 text-xs text-ink-soft">
          Last updated {new Date(recordedAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
