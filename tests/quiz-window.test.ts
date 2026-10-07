import { describe, expect, it } from "vitest";
import { joinDateTime, localIsoDate, quizWindowError, splitDateTime } from "@/lib/quizWindow";

const now = new Date("2026-10-07T12:00:00");

describe("quizWindowError", () => {
  it("accepts an empty window", () => {
    expect(quizWindowError(undefined, undefined, now)).toBeNull();
    expect(quizWindowError("", "", now)).toBeNull();
  });

  it("accepts a future window", () => {
    expect(quizWindowError("2026-10-08T09:00", "2026-10-08T10:00", now)).toBeNull();
  });

  it("rejects an opening time in the past", () => {
    expect(quizWindowError("2026-10-06T09:00", undefined, now)).toBe(
      "Opening time can't be in the past."
    );
  });

  it("rejects a closing time in the past", () => {
    expect(quizWindowError(undefined, "2026-10-06T09:00", now)).toBe(
      "Closing time can't be in the past."
    );
  });

  it("tolerates a form that has been open for under a minute", () => {
    expect(quizWindowError("2026-10-07T11:59:30", undefined, now)).toBeNull();
  });

  it("rejects a close at or before the open", () => {
    expect(quizWindowError("2026-10-08T10:00", "2026-10-08T10:00", now)).toBe(
      "Closing time must be after the opening time."
    );
    expect(quizWindowError("2026-10-08T10:00", "2026-10-08T09:00", now)).toBe(
      "Closing time must be after the opening time."
    );
  });

  it("rejects unparseable values", () => {
    expect(quizWindowError("not-a-date", undefined, now)).toBe("That date or time isn't valid.");
  });
});

describe("date helpers", () => {
  it("localIsoDate uses the local calendar date, not UTC", () => {
    // 00:30 local on the 7th: UTC may still be the 6th in UTC+1, but the
    // local date must stay the 7th.
    expect(localIsoDate(new Date(2026, 9, 7, 0, 30))).toBe("2026-10-07");
  });

  it("splits and joins date-times", () => {
    expect(splitDateTime("2026-10-08T09:30")).toEqual({ date: "2026-10-08", time: "09:30" });
    expect(joinDateTime("2026-10-08", "09:30")).toBe("2026-10-08T09:30");
    expect(joinDateTime("2026-10-08", "")).toBe("2026-10-08T00:00");
    expect(joinDateTime("", "")).toBe("");
  });
});
