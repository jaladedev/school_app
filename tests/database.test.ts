import { describe, expect, it } from "vitest";
import { formatKobo, formatLevel, scoreToLetterGrade } from "@/types/database";

describe("database display helpers", () => {
  it("formats every education level", () => {
    expect(formatLevel("primary", 4)).toBe("Primary 4");
    expect(formatLevel("jss", 2)).toBe("JSS 2");
    expect(formatLevel("sss", 3)).toBe("SS 3");
  });

  it("formats kobo as Nigerian naira", () => {
    expect(formatKobo(123456)).toBe("₦1,234.56");
    expect(formatKobo(0)).toBe("₦0.00");
  });

  it("sorts an unsorted grade scale and falls back to its lowest grade", () => {
    const scale = [
      { grade: "C", min: 50 },
      { grade: "A", min: 70 },
      { grade: "B", min: 60 },
      { grade: "F", min: 0 },
    ];

    expect(scoreToLetterGrade(73, scale)).toBe("A");
    expect(scoreToLetterGrade(62, scale)).toBe("B");
    expect(scoreToLetterGrade(10, scale)).toBe("F");
    expect(scoreToLetterGrade(50, [])).toBe("—");
  });
});
