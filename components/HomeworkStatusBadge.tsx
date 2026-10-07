import type { HomeworkDisplayStatus } from "@/types/database";

const STYLE: Record<HomeworkDisplayStatus, string> = {
  given: "bg-marigold/20 text-marigold-text",
  submitted: "bg-paper text-ink-soft",
  reviewed: "bg-leaf-soft text-leaf",
  graded: "bg-sky-100 text-sky-800",
};

const LABEL: Record<HomeworkDisplayStatus, string> = {
  given: "Given",
  submitted: "Submitted",
  reviewed: "Reviewed",
  graded: "Graded",
};

export function HomeworkStatusBadge({ status }: { status: HomeworkDisplayStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STYLE[status]}`}>
      {LABEL[status]}
    </span>
  );
}
