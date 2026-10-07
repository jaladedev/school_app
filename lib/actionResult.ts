/**
 * Server actions that fail should *return* the failure, not throw it.
 *
 * In a production build Next.js replaces the message of any error thrown
 * from a server action with a generic "An error occurred in the Server
 * Components render..." string (the real one is only kept in the server
 * logs), so a thrown "Reason is required" or "Only an HOD can..." never
 * reaches the person. Returning `{ ok: false, error }` keeps the message.
 */
export type ActionResult<T = void> =
  | ({ ok: true } & (T extends void ? Record<never, never> : { data: T }))
  | { ok: false; error: string };

export async function runAction<T = void>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return (data === undefined ? { ok: true } : { ok: true, data }) as ActionResult<T>;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}
