import { describe, expect, it } from "vitest";
import { computeSubjectPercent, ordinal, rankDescending } from "@/lib/report-card";

describe("report-card scoring and ranking", () => {
  it("calculates unweighted scores from earned points and available points", () => {
    expect(
      computeSubjectPercent(
        "student-1",
        ["ca", "exam"],
        new Map([
          ["ca", 20],
          ["exam", 80],
        ]),
        new Map([
          ["ca", null],
          ["exam", null],
        ]),
        [
          { assessment_id: "ca", student_id: "student-1", score: 16 },
          { assessment_id: "exam", student_id: "student-1", score: 56 },
        ]
      )
    ).toBe(72);
  });

  it("uses assessment weights only when every assessment is weighted", () => {
    expect(
      computeSubjectPercent(
        "student-1",
        ["ca", "exam"],
        new Map([
          ["ca", 20],
          ["exam", 100],
        ]),
        new Map([
          ["ca", 30],
          ["exam", 70],
        ]),
        [
          { assessment_id: "ca", student_id: "student-1", score: 10 },
          { assessment_id: "exam", student_id: "student-1", score: 80 },
        ]
      )
    ).toBe(71);
  });

  it("returns null when the student has no approved grades for a subject", () => {
    expect(
      computeSubjectPercent(
        "student-1",
        ["exam"],
        new Map([["exam", 100]]),
        new Map([["exam", null]]),
        []
      )
    ).toBeNull();
  });

  it("uses competition ranking and correct ordinal suffixes", () => {
    expect(rankDescending([90, 80, 80, 70])).toEqual([1, 2, 2, 4]);
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(12)).toBe("12th");
    expect(ordinal(23)).toBe("23rd");
  });
});
