"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
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

// AssessmentChip's marker (lib/tiptap/assessment-node.tsx). Split out and
// rendered as a real link below -- it used to be regex-stripped here with
// nothing put in its place (see splitContentByMarkers's old comment: "no
// per-student rendering for it here... out of scope"), which meant a
// teacher's "Link assessment" never actually reached a student anywhere
// clickable, despite looking linked in the teacher's own editor.
const ASSESSMENT_MARKER = /\[\[assessment:([0-9a-fA-F-]{36})\]\]/g;

// TopicLinkChip's marker (lib/tiptap/topic-link-node.tsx) -- same
// "split out and rendered as a real link" treatment as ASSESSMENT_MARKER
// above, for the same reason: a teacher's "Link topic" needs to reach
// students as something clickable, not get silently stripped.
const TOPIC_LINK_MARKER = /\[\[topic:([0-9a-fA-F-]{36})\]\]/g;

export type LinkedAssessment = {
  id: string;
  title: string;
  assessment_type: string;
  quizId?: string;
};

export type LinkedTopic = {
  id: string;
  title: string;
};

const ASSESSMENT_TYPE_ICON: Record<string, string> = {
  first_ca: "📋",
  second_ca: "📋",
  exam: "📝",
  test: "❓",
  assignment: "📚",
  project: "🛠️",
  practical: "🧪",
  quiz: "🧩",
  other: "📊",
};

export type ContentPart =
  | { type: "text"; value: string }
  | { type: "resource"; resource: TopicResource; size?: ImageSize; align?: ImageAlign }
  | { type: "assessment"; assessment: LinkedAssessment }
  | { type: "topic"; topic: LinkedTopic };

export function splitContentByMarkers(
  content: string,
  resources: TopicResource[],
  linkedAssessments: LinkedAssessment[] = [],
  linkedTopics: LinkedTopic[] = []
): { parts: ContentPart[]; leftover: TopicResource[] } {
  const assessmentsById = new Map(linkedAssessments.map((a) => [a.id, a]));
  const topicsById = new Map(linkedTopics.map((t) => [t.id, t]));
  const byId = new Map(resources.map((r) => [r.id, r]));
  const usedIds = new Set<string>();
  const parts: ContentPart[] = [];

  // Three marker shapes can appear interleaved in the same content
  // string ([[resource:...]], [[assessment:...]], [[topic:...]]), so all
  // three regexes have to be walked together in document order -- same
  // reasoning as the resource/assessment combined regex below: splitting
  // any one of them out and processing it separately would silently
  // reorder it to "not present" relative to the others.
  const combined = new RegExp(
    `${RESOURCE_MARKER.source}|${ASSESSMENT_MARKER.source}|${TOPIC_LINK_MARKER.source}`,
    "g"
  );
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  combined.lastIndex = 0;

  while ((match = combined.exec(content))) {
    const textChunk = content.slice(lastIndex, match.index);
    if (textChunk.trim()) parts.push({ type: "text", value: textChunk });

    if (match[1]) {
      // Resource marker: groups 1-3 are id/size/align.
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
    } else if (match[4]) {
      // Assessment marker: group 4 is the id.
      const assessment = assessmentsById.get(match[4]);
      if (assessment) parts.push({ type: "assessment", assessment });
      // Same silent-drop behavior for a deleted/inaccessible assessment
      // (e.g. RLS denies it, or it was removed after the note was
      // published) -- no broken "[[assessment:...]]" text on the page.
    } else if (match[5]) {
      // Topic-link marker: group 5 is the id.
      const linkedTopic = topicsById.get(match[5]);
      if (linkedTopic) parts.push({ type: "topic", topic: linkedTopic });
      // Same silent-drop behavior as assessment/resource above.
    }

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
  linkedAssessments = [],
  linkedTopics = [],
}: {
  content: string;
  resources: TopicResource[];
  linkedAssessments?: LinkedAssessment[];
  linkedTopics?: LinkedTopic[];
}) {
  const { parts, leftover } = splitContentByMarkers(
    content,
    resources,
    linkedAssessments,
    linkedTopics
  );

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
        ) : part.type === "assessment" ? (
          <AssessmentLink key={part.assessment.id} assessment={part.assessment} />
        ) : part.type === "topic" ? (
          <TopicLink key={part.topic.id} topic={part.topic} />
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

// Quiz-backed assessments have a real per-student page to deep-link to
// (start/continue the timed attempt). Non-quiz assessments (tests, exams,
// etc.) are graded manually by a teacher and only ever surface in the
// aggregate grades list -- there's no per-assessment student route for
// those, so the link falls back to that list rather than a 404.
function AssessmentLink({ assessment }: { assessment: LinkedAssessment }) {
  const href = assessment.quizId
    ? `/dashboard/student/quizzes/${assessment.quizId}/attempt`
    : "/dashboard/student/grades";
  return (
    <Link
      href={href}
      className="my-4 flex items-center gap-3 rounded-xl border border-rule bg-white p-3 transition hover:border-marigold"
    >
      <span aria-hidden className="text-xl">
        {ASSESSMENT_TYPE_ICON[assessment.assessment_type] ?? "📊"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{assessment.title}</span>
        <span className="block text-xs text-ink-soft">
          {assessment.assessment_type.replace(/_/g, " ")}
          {assessment.quizId ? " · Start quiz" : " · View in grades"}
        </span>
      </span>
    </Link>
  );
}

// Same "real clickable card, not a stripped marker" treatment as
// AssessmentLink above. Every topic has the same one student-facing
// route, so there's no quiz/non-quiz branching to do here.
function TopicLink({ topic }: { topic: LinkedTopic }) {
  return (
    <Link
      href={`/dashboard/student/topics/${topic.id}`}
      className="my-4 flex items-center gap-3 rounded-xl border border-rule bg-white p-3 transition hover:border-marigold"
    >
      <span aria-hidden className="text-xl">
        📄
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{topic.title}</span>
        <span className="block text-xs text-ink-soft">Related topic</span>
      </span>
    </Link>
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
      // #22 Link Preview: `description`/`file_url` (repurposed as the
      // og:image URL for `link` resources specifically -- see
      // createLinkResource) are only populated when the URL was added
      // through the "Add link" panel or paste-a-bare-URL, which fetch
      // that metadata server-side. A `link` resource without either
      // (e.g. one added before this feature existed, or a page with no
      // og: tags at all) falls back to the original bare-link
      // rendering rather than showing an empty card shell.
      if (resource.description || resource.file_url) {
        let hostname = resource.content ?? "";
        try {
          hostname = resource.content ? new URL(resource.content).hostname : "";
        } catch {
          // keep the raw content as a last resort
        }
        return (
          <a
            href={resource.content ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="my-4 flex overflow-hidden rounded-xl border border-rule bg-white transition hover:border-marigold"
          >
            {resource.file_url && !failed && (
              <div className="hidden w-40 shrink-0 bg-paper sm:block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resource.file_url}
                  alt=""
                  loading="lazy"
                  onError={() => setFailed(true)}
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <div className="min-w-0 flex-1 p-3">
              <p className="truncate text-sm font-medium text-ink">
                {resource.title ?? resource.content}
              </p>
              {resource.description && (
                <p className="mt-1 line-clamp-2 text-xs text-ink-soft">{resource.description}</p>
              )}
              {hostname && <p className="mt-1.5 truncate text-xs text-ink-soft/70">{hostname}</p>}
            </div>
          </a>
        );
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
