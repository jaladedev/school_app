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
    // redirect() / notFound() work by throwing; swallowing them would
    // silently cancel the navigation.
    if (isNextControlFlowError(err)) throw err;
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

function isNextControlFlowError(err: unknown): boolean {
  const digest = (err as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}

/**
 * Caller-side counterpart to runAction: awaits an action's result and, on
 * failure, throws an Error carrying the *real* message. The throw happens in
 * the caller's own (client) code, so it is never redacted by Next.js, and
 * existing `catch (err) { err.message }` handlers keep working unchanged.
 * New code can instead branch on `result.ok` directly.
 */
export async function unwrapAction<T>(pending: Promise<ActionResult<T>>): Promise<T> {
  const result = await pending;
  if (!result.ok) throw new Error(result.error);
  return (result as { data?: T }).data as T;
}
