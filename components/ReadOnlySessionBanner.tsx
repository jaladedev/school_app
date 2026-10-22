"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SignOutButton } from "@/components/SignOutButton";
import { isReadOnlyUser, readOnlyUntil } from "@/lib/readOnlySession";

// Shown across the dashboard during a read-only support session, so nobody
// mistakes it for the school's own admin. Display only: the session is kept
// read-only by the database and the server actions, not by this banner.
export function ReadOnlySessionBanner() {
  const [until, setUntil] = useState<Date | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (cancelled || !isReadOnlyUser(data.user)) return;
        setActive(true);
        setUntil(readOnlyUntil(data.user));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!active) return null;

  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <span>
        <strong>Read-only support session.</strong> You are viewing this school as platform support.
        Nothing can be changed, and every page you open is recorded in the audit log.
        {until && (
          <> Ends at {until.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.</>
        )}
      </span>
      <SignOutButton />
    </div>
  );
}
