/**
 * True for the errors Next.js throws to steer rendering (opting a route out
 * of static rendering when cookies() is read, redirects, notFound). A
 * try/catch around code that may call cookies() must rethrow these, or the
 * route silently loses its dynamic-rendering signal.
 */
export function isNextControlFlowError(err: unknown): boolean {
  const digest = (err as { digest?: unknown } | null)?.digest;
  return (
    typeof digest === "string" &&
    (digest === "DYNAMIC_SERVER_USAGE" ||
      digest === "BAILOUT_TO_CLIENT_SIDE_RENDERING" ||
      digest.startsWith("NEXT_"))
  );
}
