"use client";

import { isTransientAuthError } from "@/lib/authErrors";

type ErrorStateProps = {
  message?: string;
  // Named onRetryAction (not onRetry) so Next's server/client boundary
  // linter doesn't flag it: it treats any non-Server-Action function prop
  // on a "use client" component as potentially crossing the server/client
  // boundary unserialized, based on naming convention alone, regardless of
  // whether a given call site actually stays client-to-client. Every
  // caller here does (error.tsx's reset callback, both "use client"), but
  // the *Action suffix satisfies the check.
  onRetryAction?: () => void;
  retryHref?: string;
  fullScreen?: boolean;
};

/**
 * Shared "something went wrong" UI.
 *
 * Used both by Next's error.tsx boundaries (which can pass a `reset()`
 * callback) and by places like DashboardLayout that catch a thrown error
 * manually — a server component layout can't rely on error.tsx to cover
 * errors thrown inside itself, since error.tsx only wraps its segment's
 * page.tsx and children, not its own layout.tsx. See getCurrentProfile's
 * doc comment in lib/supabase/server.ts for why that matters here.
 *
 * Detects the specific "transient auth failure" case (a network blip
 * verifying the session, not actually being logged out -- see
 * lib/authErrors.ts) and swaps in a more targeted heading/copy for it,
 * since "Something went wrong" reads as more alarming and less
 * actionable than this case actually is: retrying almost always just
 * works.
 */
export function ErrorState({ message, onRetryAction, retryHref, fullScreen }: ErrorStateProps) {
  const isTransientAuth = isTransientAuthError(message);

  return (
    <div
      className={
        fullScreen
          ? "flex min-h-screen flex-col items-center justify-center bg-paper px-4 text-center"
          : "flex min-h-[50vh] flex-col items-center justify-center text-center"
      }
    >
      <p className="mb-2 font-display text-xl font-semibold text-ink">
        {isTransientAuth ? "Connection issue" : "Something went wrong"}
      </p>
      <p className="mb-6 max-w-sm text-sm text-ink-soft">
        {message || "An unexpected error occurred loading this page."}
      </p>
      <div className="flex gap-2">
        {onRetryAction && (
          <button
            onClick={onRetryAction}
            className="rounded-lg bg-marigold px-4 py-2 text-sm font-medium text-ink hover:bg-marigold-dark"
          >
            Try again
          </button>
        )}
        {retryHref && (
          <a
            href={retryHref}
            className="rounded-lg border border-rule px-4 py-2 text-sm text-ink hover:bg-paper"
          >
            Back to dashboard
          </a>
        )}
      </div>
    </div>
  );
}
