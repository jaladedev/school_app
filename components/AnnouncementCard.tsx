"use client";

import { useEffect, useState } from "react";

type AnnouncementCardProps = {
  id: string;
  title: string;
  content: string;
  authorName: string;
  audience: "all" | "students" | "teachers" | "class";
  createdAt: string;
  timeAgo: string;
};

const STORAGE_PREFIX = "announcement-read:";

export function AnnouncementCard({
  id,
  title,
  content,
  authorName,
  audience,
  createdAt,
  timeAgo,
}: AnnouncementCardProps) {
  const [isRead, setIsRead] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = window.localStorage.getItem(`${STORAGE_PREFIX}${id}`);
    setIsRead(stored === "1");
  }, [id]);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem(`${STORAGE_PREFIX}${id}`, isRead ? "1" : "0");
  }, [id, isRead, mounted]);

  function handleMarkRead() {
    setIsRead(true);
  }

  return (
    <div className="rounded-xl border border-rule bg-white p-4">
      <div className="mb-1 flex items-center justify-between gap-3">
        <p className="font-display text-lg font-semibold text-ink">{title}</p>
        <span className="text-xs text-ink-soft">{timeAgo}</span>
      </div>

      <p className="mb-2 text-sm text-ink">{content}</p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-soft">
          {authorName} · {audience === "class" ? "This class" : audience}
        </p>

        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-1 text-[11px] font-medium ${
              isRead ? "bg-leaf-soft text-leaf" : "bg-marigold-soft text-ink"
            }`}
          >
            {isRead ? "Read" : "Unread"}
          </span>
          {!isRead && (
            <button
              type="button"
              onClick={handleMarkRead}
              className="text-xs font-medium text-ink-soft hover:text-clay hover:underline"
            >
              Mark as read
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 text-[11px] text-ink-soft">
        Posted {new Date(createdAt).toLocaleString()}
      </div>
    </div>
  );
}
