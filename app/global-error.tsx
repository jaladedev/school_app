"use client";

import { ErrorState } from "@/components/ErrorState";
import "./globals.css";

// global-error.tsx replaces the ENTIRE root layout (app/layout.tsx) when it
// renders, so -- unlike every other error.tsx in this app -- it must supply
// its own <html>/<body>. It's the only boundary that can catch an error
// thrown by app/layout.tsx itself or by app/error.tsx itself: error.tsx
// never covers throws from its own segment's layout.tsx (same reason
// dashboard/layout.tsx needed a manual try/catch instead of relying on
// dashboard/error.tsx), and there's nothing above app/error.tsx in the
// segment tree except this file. Root layout currently does no async work
// and can't throw in practice, so this is defense-in-depth rather than a
// fix for something reachable today -- same relationship this has to
// app/error.tsx as app/dashboard/not-found.tsx has to app/dashboard/error.tsx.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper font-body text-ink antialiased">
        <ErrorState message={error.message} onRetryAction={reset} fullScreen />
      </body>
    </html>
  );
}
