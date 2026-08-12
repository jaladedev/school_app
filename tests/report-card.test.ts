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
});
