"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertRole } from "@/lib/actions/authGuards";
import { throwDbError } from "@/lib/errors/db";

/**
 * curriculum_topics has SELECT/INSERT/UPDATE RLS policies but no DELETE
 * policy at all, so removing a topic can't go through the session client
 * no matter who's asking — it has to go through the admin client after
 * an app-level role check, same shape as voidInvoice()/deleteAsset() etc.
 * elsewhere in this codebase.
 *
 * Deletion is blocked if anything already references this topic (a
 * lesson's topic_id, or a topic_note/topic_resource) — better to force
 * an explicit decision about that content than silently orphan or
 * cascade-delete it.
 */
export async function deleteCurriculumTopic(topicId: string) {
  await assertRole(["admin"], "Only an admin can delete a curriculum topic.");
  const admin = createAdminClient();

  const [{ count: lessonCount }, { count: noteCount }, { count: resourceCount }] =
    await Promise.all([
      admin.from("lessons").select("id", { count: "exact", head: true }).eq("topic_id", topicId),
      admin
        .from("topic_notes")
        .select("id", { count: "exact", head: true })
        .eq("topic_id", topicId),
      admin
        .from("topic_resources")
        .select("id", { count: "exact", head: true })
        .eq("topic_id", topicId),
    ]);

  if (lessonCount) {
    throw new Error(
      `This topic is linked to ${lessonCount} lesson${lessonCount === 1 ? "" : "s"} — unlink those first.`
    );
  }
  if (noteCount) {
    throw new Error(
      `This topic has ${noteCount} note${noteCount === 1 ? "" : "s"} attached — remove ${
        noteCount === 1 ? "it" : "them"
      } first.`
    );
  }
  if (resourceCount) {
    throw new Error(
      `This topic has ${resourceCount} resource${resourceCount === 1 ? "" : "s"} attached directly — remove ${
        resourceCount === 1 ? "it" : "them"
      } first.`
    );
  }

  const { error } = await admin.from("curriculum_topics").delete().eq("id", topicId);
  if (error) throwDbError(error);

  revalidatePath("/dashboard/admin/curriculum");
  revalidatePath("/dashboard/teacher/notes");
}
