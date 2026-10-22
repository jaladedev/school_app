// Read-only support sessions (audited impersonation). Pure helpers with no
// Node or Next.js dependencies, so middleware, server actions and tests can
// all use them.
//
// A support session signs in as a dedicated "platform support" admin account
// whose auth user has app_metadata.read_only = true. app_metadata is part of
// the JWT and cannot be edited by the user (user_metadata can, which is why
// it is never used here). The database refuses all writes while the flag is
// set (supabase/migrations/20261022120000_read_only_sessions.sql); the
// helpers below are the app-layer half, for service-role writes that bypass
// the database's policies.

export const READ_ONLY_MESSAGE = "This is a read-only support session, so changes can't be made.";

/** How long a support session lasts once opened. */
export const READ_ONLY_SESSION_MINUTES = 30;

type UserWithMetadata = { app_metadata?: Record<string, unknown> | null } | null | undefined;

export function isReadOnlyUser(user: UserWithMetadata): boolean {
  return user?.app_metadata?.read_only === true;
}

/** When the support session ends, or null when the user has no such session. */
export function readOnlyUntil(user: UserWithMetadata): Date | null {
  const raw = user?.app_metadata?.read_only_until;
  if (typeof raw !== "string") return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * True when a read-only user's session is over. A read-only user with no
 * valid end time counts as expired (fail closed), so a support account can
 * never become a standing login.
 */
export function isReadOnlySessionExpired(user: UserWithMetadata, now: Date = new Date()): boolean {
  if (!isReadOnlyUser(user)) return false;
  const until = readOnlyUntil(user);
  return !until || now.getTime() >= until.getTime();
}

/** Throws in a read-only support session. For actions that bypass assertRole. */
export function assertNotReadOnly(user: UserWithMetadata): void {
  if (isReadOnlyUser(user)) throw new Error(READ_ONLY_MESSAGE);
}
