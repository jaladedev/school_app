// Messages for the `?reason=` the middleware adds when it sends someone to
// the login page. Only known reasons are shown, from this allow-list; the raw
// query value is never rendered.
const MESSAGES: Record<string, string> = {
  "support-session-ended": "Your support session has ended. Sign in to continue.",
  deactivated: "This account has been deactivated. Contact your school administrator.",
};

export function loginReasonMessage(reason: string | null | undefined): string | null {
  if (!reason) return null;
  return Object.prototype.hasOwnProperty.call(MESSAGES, reason) ? MESSAGES[reason] : null;
}
