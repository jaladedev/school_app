"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github-dark.css";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import { videoEmbedUrl } from "@/lib/video-embed";
import type { ImageAlign, ImageSize } from "@/lib/tiptap/resource-node";
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

// Matches a marker like [[resource:3f9e1a2b-...]] placed on its own line
// in a note's markdown. Lets a teacher choose exactly where a resource
// appears in the flow of the text — e.g. right after the sentence that
// references it — instead of every resource always landing at the end
// of the note regardless of what the prose actually says about it.
//
// The optional `#size-align` suffix (e.g. `#full`, `#small-right`) is
// written by the image resize/alignment controls in the TipTap editor
// (see lib/tiptap/resource-node.tsx) -- this regex has to stay in sync
// with the one there, or a note saved with an image size/alignment set
// would render as broken literal "[[resource:...#full]]" text here
// instead of the image.
const RESOURCE_MARKER = /\[\[resource:([0-9a-fA-F-]{36})(?:#([a-z]+)(?:-([a-z]+))?)?\]\]/g;

export type ContentPart =
  | { type: "text"; value: string }
  | { type: "resource"; resource: TopicResource; size?: ImageSize; align?: ImageAlign };

export function splitContentByMarkers(
  content: string,
  resources: TopicResource[]
): { parts: ContentPart[]; leftover: TopicResource[] } {
  const byId = new Map(resources.map((r) => [r.id, r]));
  const usedIds = new Set<string>();
  const parts: ContentPart[] = [];

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  RESOURCE_MARKER.lastIndex = 0;

  while ((match = RESOURCE_MARKER.exec(content))) {
    const textChunk = content.slice(lastIndex, match.index);
    if (textChunk.trim()) parts.push({ type: "text", value: textChunk });

    const resource = byId.get(match[1]);
    if (resource) {
      const size = (match[2] as ImageSize | undefined) || undefined;
      const align = (match[3] as ImageAlign | undefined) || undefined;
      parts.push({ type: "resource", resource, size, align });
      usedIds.add(resource.id);
    }
    // An unmatched marker (resource deleted, or id typo) is silently
    // dropped from the rendered output rather than left as literal
    // "[[resource:...]]" text on the page.

    lastIndex = match.index + match[0].length;
  }

  const remainder = content.slice(lastIndex);
  if (remainder.trim()) parts.push({ type: "text", value: remainder });

  // Any resource never referenced by a marker still needs to show up
  // somewhere — same as the old behavior, appended after everything else,
  // so nothing silently disappears just because a note wasn't written
  // with markers.
  const leftover = resources.filter((r) => !usedIds.has(r.id));

  return { parts, leftover };
}

export function TopicContent({
  content,
  resources,
}: {
  content: string;
  resources: TopicResource[];
}) {
  const { parts, leftover } = splitContentByMarkers(content, resources);

  return (
    <div>
      {parts.map((part, i) =>
        part.type === "text" ? (
          <div className="topic-prose" key={i}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex, rehypeHighlight]}
            >
              {part.value}
            </ReactMarkdown>
          </div>
        ) : (
          <TopicResourceItem
            key={part.resource.id}
            resource={part.resource}
            size={part.size}
            align={part.align}
          />
        )
      )}

      {leftover.map((resource) => (
        <TopicResourceItem key={resource.id} resource={resource} />
      ))}
    </div>
  );
}

const IMAGE_SIZE_CLASS: Record<ImageSize, string> = {
  small: "max-w-xs",
  medium: "max-w-xl",
  full: "w-full",
};
const IMAGE_ALIGN_CLASS: Record<ImageAlign, string> = {
  left: "mr-auto",
  center: "mx-auto",
  right: "ml-auto",
};

export function TopicResourceItem({
  resource,
  size,
  align,
}: {
  resource: TopicResource;
  size?: ImageSize;
  align?: ImageAlign;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const [failed, setFailed] = useState(false);

  switch (resource.resource_type) {
    case "diagram_mermaid":
      return <MermaidDiagram code={resource.content ?? ""} title={resource.title} />;

    case "image":
      return (
        <figure
          ref={ref}
          className={`my-4 ${size ? IMAGE_SIZE_CLASS[size] : ""} ${align ? IMAGE_ALIGN_CLASS[align] : ""}`}
        >
          {failed ? (
            <MediaError label="Image" />
          ) : inView ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resource.file_url ?? ""}
              alt={resource.title ?? "Diagram"}
              loading="lazy"
              onError={() => setFailed(true)}
              className="w-full rounded-xl border border-rule"
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
      {
        const embedUrl = resource.content ? videoEmbedUrl(resource.content) : null;
        if (embedUrl) {
          return (
            <section
              ref={ref}
              className="my-4 overflow-hidden rounded-xl border border-rule bg-black"
            >
              <iframe
                title={resource.title ?? "Embedded video"}
                src={embedUrl}
                className="aspect-video w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </section>
          );
        }
      }
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
