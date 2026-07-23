import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import type { TopicResource } from "@/types/database";

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

      {resources.map((resource) => {
        switch (resource.resource_type) {
          case "diagram_mermaid":
            return (
              <MermaidDiagram
                key={resource.id}
                code={resource.content ?? ""}
                title={resource.title}
              />
            );
          case "image":
            return (
              <figure key={resource.id} className="my-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resource.file_url ?? ""}
                  alt={resource.title ?? "Diagram"}
                  className="rounded-xl border border-rule"
                />
              </figure>
            );
          case "video":
            return (
              <video
                key={resource.id}
                src={resource.file_url ?? ""}
                controls
                className="my-4 w-full rounded-xl border border-rule"
              />
            );
          case "pdf":
            return (
              <section
                key={resource.id}
                className="my-4 overflow-hidden rounded-xl border border-rule bg-white"
              >
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
                <iframe
                  title={resource.title ?? "PDF resource"}
                  src={resource.file_url ?? ""}
                  className="h-[32rem] w-full"
                />
              </section>
            );
          case "audio":
            return (
              <section
                key={resource.id}
                className="my-4 rounded-xl border border-rule bg-white p-4"
              >
                {resource.title && (
                  <p className="mb-2 text-sm font-medium text-ink">{resource.title}</p>
                )}
                <audio controls className="w-full">
                  <source src={resource.file_url ?? ""} />
                  Your browser does not support audio playback.
                </audio>
              </section>
            );
          case "link":
            return (
              <a
                key={resource.id}
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
      })}
    </div>
  );
}
