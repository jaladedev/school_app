import { createAdminClient } from "@/lib/supabase/admin";
import { TOPIC_RESOURCE_BUCKET } from "@/lib/storageBuckets";
import type { TopicResource } from "@/types/database";

/**
 * Swaps each resource's stored storage path for a time-limited signed
 * URL, leaving already-absolute URLs (video embeds, link previews --
 * anything starting with "http") untouched.
 *
 * Lives here, in lib/actions/ (which is on the no-restricted-imports
 * allowlist for createAdminClient -- see .eslintrc.json), specifically
 * so that admin-client usage for this has exactly one reviewed call
 * site instead of being duplicated inline in every page that needs to
 * display topic resources. Signing requires the admin client because
 * Supabase Storage's createSignedUrl isn't reachable through an
 * RLS-scoped anon/user client; by the time this runs, the caller has
 * already fetched `resources` through the RLS-scoped client, so
 * whichever rows are visible to sign are exactly the ones the current
 * user's RLS policies already allowed them to see -- this only signs
 * URLs for resources the caller already legitimately has.
 */
export async function signTopicResourceUrls<T extends Pick<TopicResource, "file_url">>(
  resources: T[]
): Promise<T[]> {
  const admin = createAdminClient();
  return Promise.all(
    resources.map(async (resource) => {
      if (!resource.file_url || resource.file_url.startsWith("http")) return resource;
      const { data: signed } = await admin.storage
        .from(TOPIC_RESOURCE_BUCKET)
        .createSignedUrl(resource.file_url, 6 * 60 * 60);
      return { ...resource, file_url: signed?.signedUrl ?? null };
    })
  );
}
