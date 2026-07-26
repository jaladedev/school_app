"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Best-effort — an install failure (e.g. dev mode over http on a
      // non-localhost origin) shouldn't break the rest of the app.
    });
  }, []);

  return null;
}
