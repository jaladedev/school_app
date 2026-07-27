"use client";

import { useEffect, useRef, useState } from "react";
import { recordTransportLocation } from "@/lib/actions/transport";
import { emitToast } from "@/lib/toast";
import type { TripDirection } from "@/types/database";

// Throttles how often a position update is actually sent — watchPosition
// can fire far more often than that's useful for a bus on a school run.
const SEND_INTERVAL_MS = 20_000;

export function LiveLocationSender({
  routeId,
  tripDate,
  direction,
}: {
  routeId: string;
  tripDate: string;
  direction: TripDirection;
}) {
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  function startSharing() {
    setError(null);
    if (!("geolocation" in navigator)) {
      setError("This device/browser doesn't support location sharing.");
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSentRef.current < SEND_INTERVAL_MS) return;
        lastSentRef.current = now;

        recordTransportLocation({
          routeId,
          tripDate,
          direction,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }).catch((err) => {
          emitToast(err instanceof Error ? err.message : "Couldn't send location.", "error");
        });
      },
      (err) => {
        setError(err.message || "Couldn't get this device's location.");
        setSharing(false);
      },
      { enableHighAccuracy: true, maximumAge: 10_000 }
    );

    watchIdRef.current = id;
    setSharing(true);
  }

  function stopSharing() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setSharing(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs capitalize text-ink-soft">{direction} location:</span>
      {sharing ? (
        <button
          onClick={stopSharing}
          className="rounded-full bg-clay px-2.5 py-1 text-xs font-medium text-white hover:bg-clay/90"
        >
          Stop sharing
        </button>
      ) : (
        <button
          onClick={startSharing}
          className="rounded-full border border-rule px-2.5 py-1 text-xs font-medium text-ink hover:bg-leaf-soft"
        >
          Share this device&apos;s location
        </button>
      )}
      {sharing && (
        <span className="text-xs text-leaf">
          Sharing — keep this page open while the trip is on.
        </span>
      )}
      {error && <p className="w-full text-xs text-clay">{error}</p>}
    </div>
  );
}
