import { createSignedUrls } from "@/lib/storage";
import { TOPIC_RESOURCE_BUCKET } from "@/lib/storageBuckets";
import type { TopicResource } from "@/types/database";

/**
 * Swaps each resource's stored storage path for a time-limited signed
 * URL, leaving already-absolute URLs (video embeds, link previews --
 * anything starting with "http") untouched.
 *
 * Lives here, in lib/actions/, so that signing has exactly one reviewed
 * call site instead of being duplicated inline in every page that needs
 * to display topic resources. Signing uses the school's R2 credentials
 * (lib/storage.ts), which bypass row-level security: by the time this
 * runs, the caller has already fetched `resources` through the
 * RLS-scoped client, so whichever rows are visible to sign are exactly
 * the ones the current user's RLS policies already allowed them to see
 * -- this only signs URLs for resources the caller already legitimately
 * has.
 */
export async function signTopicResourceUrls<T extends Pick<TopicResource, "file_url">>(
  resources: T[]
): Promise<T[]> {
  const paths = resources
    .map((r) => r.file_url)
    .filter((p): p is string => !!p && !p.startsWith("http"));
  const urlByPath = await createSignedUrls(TOPIC_RESOURCE_BUCKET, paths, 6 * 60 * 60);
  return resources.map((resource) => {
    if (!resource.file_url || resource.file_url.startsWith("http")) return resource;
    return { ...resource, file_url: urlByPath.get(resource.file_url) ?? null };
  });
}
