/**
 * Date/time helpers and validation for a quiz's open/close window.
 * Pure (no server/client imports) so the builder, the schedule editor and
 * the server actions all apply the exact same rules.
 */

/** Local calendar date as YYYY-MM-DD. toISOString() would give the UTC date,
 *  which is yesterday for part of the night in UTC+1 (Lagos). */
export function localIsoDate(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Splits a "YYYY-MM-DDTHH:mm" string into its date and time halves. */
export function splitDateTime(value: string): { date: string; time: string } {
  if (!value) return { date: "", time: "" };
  const [date, time] = value.split("T");
  return { date: date ?? "", time: time ?? "" };
}

/** Joins date + time back into "YYYY-MM-DDTHH:mm", filling whichever side is blank. */
export function joinDateTime(date: string, time: string): string {
  if (!date && !time) return "";
  return `${date || localIsoDate()}T${time || "00:00"}`;
}

/** Anything within this window of "now" still counts as now (clock skew, a
 *  form left open for a minute). */
const GRACE_MS = 60_000;

/**
 * Returns a user-facing message if the window is invalid, otherwise null.
 * Both values are optional; pass anything `new Date()` can parse.
 * A quiz can't be opened or closed in the past, and must close after it opens.
 */
export function quizWindowError(
  opensAt: string | null | undefined,
  closesAt: string | null | undefined,
  now: Date = new Date()
): string | null {
  const opens = opensAt ? new Date(opensAt) : null;
  const closes = closesAt ? new Date(closesAt) : null;

  if ((opens && Number.isNaN(opens.getTime())) || (closes && Number.isNaN(closes.getTime()))) {
    return "That date or time isn't valid.";
  }
  const cutoff = now.getTime() - GRACE_MS;
  if (opens && opens.getTime() < cutoff) return "Opening time can't be in the past.";
  if (closes && closes.getTime() < cutoff) return "Closing time can't be in the past.";
  if (opens && closes && closes.getTime() <= opens.getTime()) {
    return "Closing time must be after the opening time.";
  }
  return null;
}
