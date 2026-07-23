"use client";

import { useEffect, useState } from "react";

type ToastItem = {
  id: number;
  message: string;
  tone: "success" | "error";
};

export function ToastProvider() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    function handleToast(event: Event) {
      const customEvent = event as CustomEvent<{ message: string; tone?: "success" | "error" }>;
      const { message, tone = "success" } = customEvent.detail;

      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((prev) => [...prev, { id, message, tone }]);

      window.setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, 2500);
    }

    window.addEventListener("app:toast", handleToast);
    return () => window.removeEventListener("app:toast", handleToast);
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-lg border px-3 py-2 text-sm shadow-sm ${
            toast.tone === "error"
              ? "border-clay bg-clay/10 text-clay"
              : "border-leaf bg-leaf-soft text-leaf"
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
