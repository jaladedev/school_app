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
