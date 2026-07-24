"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import type { TopicResource } from "@/types/database";

// Defers loading a resource's actual media until it scrolls near the
// viewport, so a topic with several large videos/PDFs doesn't try to
// fetch all of them at once on page load.
function useInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!ref.current || inView) return;
    const el = ref.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView]);

  return { ref, inView };
}

function MediaError({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-rule bg-paper p-4 text-sm text-ink-soft">
      <span aria-hidden>⚠️</span>
      <span>{label} couldn&apos;t be loaded. It may have expired — try refreshing the page.</span>
    </div>
  );
}

export function TopicContent({
  content,
  resources,
}: {
  content: string;
  resources: TopicResource[];
}) {
  return (
    <div>
      <div className="topic-prose">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>

      {resources.map((resource) => (
        <TopicResourceItem key={resource.id} resource={resource} />
      ))}
    </div>
  );
}

function TopicResourceItem({ resource }: { resource: TopicResource }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const [failed, setFailed] = useState(false);

  switch (resource.resource_type) {
    case "diagram_mermaid":
      return <MermaidDiagram code={resource.content ?? ""} title={resource.title} />;

    case "image":
      return (
        <figure ref={ref} className="my-4">
          {failed ? (
            <MediaError label="Image" />
          ) : inView ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resource.file_url ?? ""}
              alt={resource.title ?? "Diagram"}
              loading="lazy"
              onError={() => setFailed(true)}
              className="rounded-xl border border-rule"
            />
          ) : (
            <div className="h-48 w-full animate-pulse rounded-xl border border-rule bg-paper" />
          )}
        </figure>
      );

    case "video":
      return (
        <div ref={ref} className="my-4">
          {failed ? (
            <MediaError label="Video" />
          ) : inView ? (
            <video
              src={resource.file_url ?? ""}
              controls
              preload="metadata"
              onError={() => setFailed(true)}
              className="w-full rounded-xl border border-rule"
            />
          ) : (
            <div className="flex h-48 w-full items-center justify-center rounded-xl border border-rule bg-paper text-sm text-ink-soft">
              Video — scroll down to load
            </div>
          )}
        </div>
      );

    case "pdf":
      return (
        <section ref={ref} className="my-4 overflow-hidden rounded-xl border border-rule bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3">
            <p className="text-sm font-medium text-ink">{resource.title ?? "PDF resource"}</p>
            <a
              href={resource.file_url ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-sm font-medium text-leaf underline"
            >
              Open PDF
            </a>
          </div>
          {failed ? (
            <div className="p-4">
              <MediaError label="PDF preview" />
            </div>
          ) : inView ? (
            <iframe
              title={resource.title ?? "PDF resource"}
              src={resource.file_url ?? ""}
              onError={() => setFailed(true)}
              className="h-[32rem] w-full"
            />
          ) : (
            <div className="flex h-[32rem] w-full items-center justify-center text-sm text-ink-soft">
              Loading preview…
            </div>
          )}
        </section>
      );

    case "audio":
      return (
        <section ref={ref} className="my-4 rounded-xl border border-rule bg-white p-4">
          {resource.title && <p className="mb-2 text-sm font-medium text-ink">{resource.title}</p>}
          {failed ? (
            <MediaError label="Audio" />
          ) : inView ? (
            <audio controls preload="none" onError={() => setFailed(true)} className="w-full">
              <source src={resource.file_url ?? ""} />
              Your browser does not support audio playback.
            </audio>
          ) : (
            <div className="h-10 w-full animate-pulse rounded bg-paper" />
          )}
        </section>
      );

    case "link":
      return (
        <a
          href={resource.content ?? "#"}
          target="_blank"
          rel="noreferrer"
          className="my-2 block text-sm font-medium text-leaf underline"
        >
          {resource.title ?? resource.content}
        </a>
      );

    default:
      return null;
  }
}
