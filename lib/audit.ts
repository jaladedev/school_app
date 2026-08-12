import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

/**
 * Writes an audit_log row from application code, for actions that don't
 * have a DB trigger covering them (grade moderation, account
 * deactivation, staff role changes). Mirrors the shape the existing
 * triggers (log_enrollment_change, log_fee_structure_change,
 * log_invoice_change) already write, so admin/audit_log.select_staff
 * consumers don't need to special-case the source.
 *
 * Best-effort: a failure here is logged but never thrown, so a broken
 * audit write can't block the actual action (deactivating a user,
 * approving a grade) from completing.
 */
export async function writeAuditLog(entry: {
  entityType: string;
  entityId: string;
  action: string;
  actorId: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("audit_log").insert({
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      action: entry.action,
      actor_id: entry.actorId,
      metadata: entry.metadata ?? {},
    });
    if (error) {
      logger.error("writeAuditLog: failed to write audit_log entry", { entry, error });
    }
  } catch (err) {
    logger.error("writeAuditLog: failed to write audit_log entry", { entry, error: err });
  }
}
