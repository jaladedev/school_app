import { TopicContent, type LinkedTopic } from "@/components/TopicContent";
import { PrintButton } from "@/components/PrintButton";
import { formatLevel, type EducationLevel } from "@/types/database";
import type { TopicResource } from "@/types/database";

/**
 * A printable version of a topic's note: same TopicContent render as
 * Student view (math, tables, resource embeds, assessment/topic links
 * all render identically), wrapped in a card with its own topic/subject/
 * term header and a PrintButton. Originally only reachable by a teacher
 * previewing their own note (NoteWorkspace's "handout" mode) -- this is
 * that same block, extracted so a student can print/save the same
 * handout for the *published* note directly from their own topic page,
 * without needing a teacher to generate it for them.
 */
export function HandoutView({
  content,
  resources,
  topics = [],
  topicMeta,
}: {
  content: string;
  resources: TopicResource[];
  topics?: LinkedTopic[];
  topicMeta?: {
    title: string;
    subjectName?: string | null;
    term: number;
    weekNumber: number;
    weekEndNumber: number;
    educationLevel: EducationLevel;
    levelNumber: number;
  };
}) {
  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <p className="text-sm text-ink-soft">
          Printable version — resource embeds, math, and links render the same as the note itself.
        </p>
        <PrintButton />
      </div>
      <div className="rounded-2xl border border-rule bg-white p-4 sm:p-8 print:border-0 print:p-0 print:shadow-none">
        {topicMeta && (
          <div className="mb-6 border-b-2 border-ink pb-4">
            <h1 className="font-display text-2xl font-semibold text-ink">{topicMeta.title}</h1>
            <p className="mt-1 text-sm text-ink-soft">
              {[
                topicMeta.subjectName,
                formatLevel(topicMeta.educationLevel, topicMeta.levelNumber),
                `Term ${topicMeta.term}`,
                topicMeta.weekEndNumber > topicMeta.weekNumber
                  ? `Weeks ${topicMeta.weekNumber}–${topicMeta.weekEndNumber}`
                  : `Week ${topicMeta.weekNumber}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        )}
        <TopicContent content={content} resources={resources} linkedTopics={topics} />
      </div>
    </div>
  );
}
