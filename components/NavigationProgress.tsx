"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * A thin top-of-page progress bar, similar to GitHub/YouTube's nav
 * indicator.
 *
 * Why this exists: Next.js App Router wraps client-side navigations in
 * React's startTransition, which intentionally keeps the current page on
 * screen (no Suspense fallback, no loading.tsx) until the destination
 * route's data is ready. For a fast navigation that's the right call — no
 * flicker — but for a slow one it means clicking a link does *nothing*
 * visible for a second or more. Relying on loading.tsx alone can't fix
 * this, since it only ever appears once the transition has already
 * decided to show a fallback.
 *
 * This component sidesteps that entirely: it listens for raw clicks on
 * same-origin links (and back/forward navigation) and shows a bar
 * immediately, synchronously, with no dependency on Suspense. It then
 * completes and fades out once the route actually changes (detected via
 * pathname/searchParams, which update after the new page has rendered).
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const prevRouteKey = useRef(routeKey);
  const doneTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Route actually changed — finish the bar.
  useEffect(() => {
    if (prevRouteKey.current === routeKey) return;
    prevRouteKey.current = routeKey;

    setPhase((current) => {
      if (current === "idle") return "idle";
      return "done";
    });
  }, [routeKey]);

  useEffect(() => {
    if (phase !== "done") return;
    doneTimeout.current = setTimeout(() => setPhase("idle"), 200);
    return () => clearTimeout(doneTimeout.current);
  }, [phase]);

  useEffect(() => {
    function isPlainLeftClick(e: MouseEvent) {
      return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
    }

    function handleClick(e: MouseEvent) {
      if (!isPlainLeftClick(e)) return;

      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor || !(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;

      const samePage =
        url.pathname === window.location.pathname && url.search === window.location.search;
      if (samePage && url.hash) return; // in-page anchor jump, not a navigation

      setPhase("loading");
    }

    function handlePopState() {
      setPhase("loading");
    }

    document.addEventListener("click", handleClick);
    window.addEventListener("popstate", handlePopState);
    return () => {
      document.removeEventListener("click", handleClick);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  if (phase === "idle") return null;

  return (
    <div
      role="status"
      aria-label="Loading"
      className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-transparent"
    >
      <div
        className={`h-full bg-marigold transition-all ease-out ${
          phase === "loading" ? "w-[75%] duration-[8000ms]" : "w-full duration-200"
        }`}
      />
    </div>
  );
}
