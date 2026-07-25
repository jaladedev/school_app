"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTopicResource } from "@/lib/actions/teacher";
import { emitToast } from "@/lib/toast";
import type { TopicResource } from "@/types/database";

const RESOURCE_TYPE_LABEL: Record<TopicResource["resource_type"], string> = {
  image: "Image",
  pdf: "PDF",
  audio: "Audio",
  video: "Video",
  diagram_mermaid: "Diagram",
  link: "Link",
};

export function TopicResourceList({ resources }: { resources: TopicResource[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (!resources.length) {
    return <p className="mt-3 text-sm text-ink-soft">No resources attached to this note yet.</p>;
  }

  function handleDelete(resourceId: string) {
    startTransition(async () => {
      try {
        await deleteTopicResource(resourceId);
        emitToast("Resource removed.");
        router.refresh();
      } catch (err: any) {
        emitToast(err.message ?? "Could not remove the resource.", "error");
      }
    });
  }

  return (
    <ul className="mt-3 space-y-2">
      {resources.map((resource) => (
        <li
          key={resource.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-rule bg-paper px-3 py-2 text-sm"
        >
          <div className="min-w-0">
            <span className="mr-2 rounded-full bg-leaf-soft px-2 py-0.5 text-xs font-medium text-leaf">
              {RESOURCE_TYPE_LABEL[resource.resource_type]}
            </span>
            <span className="truncate text-ink">{resource.title ?? "Untitled"}</span>
          </div>
          <button
            type="button"
            onClick={() => handleDelete(resource.id)}
            disabled={isPending}
            className="shrink-0 text-sm font-medium text-clay hover:underline disabled:opacity-60"
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}
