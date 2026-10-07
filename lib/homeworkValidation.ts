/**
 * Field rules for giving or editing homework, shared by both server actions
 * (and unit-tested). Pure -- no server imports.
 */
export const HOMEWORK_MAX_LENGTH = 4000;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/**
 * Returns the cleaned fields, or throws an Error with a user-facing message.
 * `lessonDate` is the date the homework is attached to; the due date can't
 * precede it.
 */
export function cleanHomeworkFields(input: {
  homework: string;
  homeworkDueAt?: string | null;
  lessonDate: string;
}): { homework: string; homeworkDueAt: string | null } {
  const homework = input.homework.trim();
  if (!homework) throw new Error("Write what the students should do.");
  if (homework.length > HOMEWORK_MAX_LENGTH) {
    throw new Error(`Homework is too long (max ${HOMEWORK_MAX_LENGTH} characters).`);
  }

  const due = input.homeworkDueAt?.trim() || null;
  if (due) {
    if (!isIsoDate(due)) throw new Error("That due date isn't valid.");
    if (due < input.lessonDate) {
      throw new Error("Homework due date can't be before the lesson date.");
    }
  }
  return { homework, homeworkDueAt: due };
}
