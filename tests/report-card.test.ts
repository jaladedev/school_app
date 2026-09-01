import { describe, expect, it } from "vitest";
import {
  computeSubjectPercent,
  indexGradesByAssessmentAndStudent,
  ordinal,
  rankDescending,
} from "@/lib/report-card-scoring";

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
        indexGradesByAssessmentAndStudent([
          { assessment_id: "ca", student_id: "student-1", score: 16 },
          { assessment_id: "exam", student_id: "student-1", score: 56 },
        ])
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
        indexGradesByAssessmentAndStudent([
          { assessment_id: "ca", student_id: "student-1", score: 10 },
          { assessment_id: "exam", student_id: "student-1", score: 80 },
        ])
      )
    ).toBe(71);
  });

  it("returns null when a student is missing a grade for one of the standard 1st CA / 2nd CA / Exam assessments", () => {
    // This is the actual shape createStandardAssessmentSet() produces:
    // weight_percent is never set, so max_score ratios (20 + 20 + 60 =
    // 100) do the weighting instead. A student who's only sat both CAs
    // should not get a final percent computed from 40 marks as if that
    // were the whole subject.
    expect(
      computeSubjectPercent(
        "student-1",
        ["1st_ca", "2nd_ca", "exam"],
        new Map([
          ["1st_ca", 20],
          ["2nd_ca", 20],
          ["exam", 60],
        ]),
        new Map([
          ["1st_ca", null],
          ["2nd_ca", null],
          ["exam", null],
        ]),
        indexGradesByAssessmentAndStudent([
          { assessment_id: "1st_ca", student_id: "student-1", score: 18 },
          { assessment_id: "2nd_ca", student_id: "student-1", score: 20 },
          // exam not yet graded
        ])
      )
    ).toBeNull();
  });

  it("computes the standard 1st CA / 2nd CA / Exam percent once all three are graded", () => {
    expect(
      computeSubjectPercent(
        "student-1",
        ["1st_ca", "2nd_ca", "exam"],
        new Map([
          ["1st_ca", 20],
          ["2nd_ca", 20],
          ["exam", 60],
        ]),
        new Map([
          ["1st_ca", null],
          ["2nd_ca", null],
          ["exam", null],
        ]),
        indexGradesByAssessmentAndStudent([
          { assessment_id: "1st_ca", student_id: "student-1", score: 18 },
          { assessment_id: "2nd_ca", student_id: "student-1", score: 20 },
          { assessment_id: "exam", student_id: "student-1", score: 50 },
        ])
      )
    ).toBe(88);
  });

  it("returns null when weighted assessments are missing a grade, instead of a partial score", () => {
    expect(
      computeSubjectPercent(
        "student-1",
        ["ca", "exam"],
        new Map([
          ["ca", 20],
          ["exam", 100],
        ]),
        new Map([
          ["ca", 20],
          ["exam", 80],
        ]),
        indexGradesByAssessmentAndStudent([
          // Full marks on the CA, but never sat the exam.
          { assessment_id: "ca", student_id: "student-1", score: 20 },
        ])
      )
    ).toBeNull();
  });

  it("returns null when the student has no approved grades for a subject", () => {
    expect(
      computeSubjectPercent(
        "student-1",
        ["exam"],
        new Map([["exam", 100]]),
        new Map([["exam", null]]),
        indexGradesByAssessmentAndStudent([])
      )
    ).toBeNull();
  });

  it("uses competition ranking and correct ordinal suffixes", () => {
    expect(rankDescending([90, 80, 80, 70])).toEqual([1, 2, 2, 4]);
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(12)).toBe("12th");
    expect(ordinal(23)).toBe("23rd");
  });

  describe("rankDescending", () => {
    it("returns an empty array for no values", () => {
      expect(rankDescending([])).toEqual([]);
    });

    it("ranks a single value 1st", () => {
      expect(rankDescending([55])).toEqual([1]);
    });

    it("ranks already-descending distinct values in order", () => {
      expect(rankDescending([90, 80, 70])).toEqual([1, 2, 3]);
    });

    it("gives every value the same rank when all values tie", () => {
      expect(rankDescending([50, 50, 50])).toEqual([1, 1, 1]);
    });

    it("keeps ranks aligned to each value's original position, regardless of input order", () => {
      // Same values as the canonical 90/80/80/70 case, but shuffled --
      // rankDescending must sort a copy and map ranks back by original
      // index, not just walk the input in whatever order it arrives.
      expect(rankDescending([70, 90, 80, 80])).toEqual([4, 1, 2, 2]);
      expect(rankDescending([80, 70, 80, 90])).toEqual([2, 4, 2, 1]);
    });

    it("handles a run of ties in the middle, skipping ranks correctly after them", () => {
      expect(rankDescending([100, 90, 90, 90, 60])).toEqual([1, 2, 2, 2, 5]);
    });

    it("works with negative and non-integer values", () => {
      expect(rankDescending([-5, -10, -5, 2.5])).toEqual([2, 4, 2, 1]);
    });
  });

  describe("indexGradesByAssessmentAndStudent", () => {
    it("returns an empty map for no grades", () => {
      const index = indexGradesByAssessmentAndStudent([]);
      expect(index.size).toBe(0);
    });

    it("indexes every (assessment, student) pair so each grade is retrievable via computeSubjectPercent", () => {
      const grades = [
        { assessment_id: "ca", student_id: "student-1", score: 15 },
        { assessment_id: "exam", student_id: "student-1", score: 70 },
        { assessment_id: "ca", student_id: "student-2", score: 18 },
      ];
      const index = indexGradesByAssessmentAndStudent(grades);
      expect(index.size).toBe(3);
      expect(Array.from(index.values())).toEqual(expect.arrayContaining(grades));

      // Round-trip through the real consumer rather than reaching into
      // the module's private key format: student-1's CA+exam should
      // resolve, and swapping in student-2 (who only has a CA grade)
      // should correctly come back null instead of accidentally
      // resolving student-1's exam grade.
      const maxScores = new Map([
        ["ca", 20],
        ["exam", 80],
      ]);
      const weights = new Map<string, number | null>([
        ["ca", null],
        ["exam", null],
      ]);
      expect(computeSubjectPercent("student-1", ["ca", "exam"], maxScores, weights, index)).toBe(
        85
      );
      expect(
        computeSubjectPercent("student-2", ["ca", "exam"], maxScores, weights, index)
      ).toBeNull();
    });

    it("does not let one student's grade collide with another student's grade on the same assessment", () => {
      const index = indexGradesByAssessmentAndStudent([
        { assessment_id: "exam", student_id: "student-1", score: 40 },
        { assessment_id: "exam", student_id: "student-2", score: 90 },
      ]);
      const maxScores = new Map([["exam", 100]]);
      const weights = new Map<string, number | null>([["exam", null]]);
      expect(computeSubjectPercent("student-1", ["exam"], maxScores, weights, index)).toBe(40);
      expect(computeSubjectPercent("student-2", ["exam"], maxScores, weights, index)).toBe(90);
    });

    it("last entry wins when the same (assessment, student) pair appears twice", () => {
      // Shouldn't happen with real data (grades has its own uniqueness
      // constraint), but the Map-based index means a duplicate silently
      // overwrites rather than throwing -- pin that behavior down.
      const index = indexGradesByAssessmentAndStudent([
        { assessment_id: "exam", student_id: "student-1", score: 40 },
        { assessment_id: "exam", student_id: "student-1", score: 90 },
      ]);
      expect(index.size).toBe(1);
      const maxScores = new Map([["exam", 100]]);
      const weights = new Map<string, number | null>([["exam", null]]);
      expect(computeSubjectPercent("student-1", ["exam"], maxScores, weights, index)).toBe(90);
    });
  });
});
