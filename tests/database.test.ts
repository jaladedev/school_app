import { describe, expect, it } from "vitest";
import { formatKobo, formatLevel, isLoanOverdue, scoreToLetterGrade } from "@/types/database";

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

  it("formats kobo amounts beyond Number.MAX_SAFE_INTEGER without losing precision", () => {
    expect(formatKobo(BigInt("900719925474099300"))).toBe("₦9,007,199,254,740,993.00");
  });

  it("formats kobo passed as a numeric string, as Postgres bigint columns may arrive", () => {
    expect(formatKobo("250000")).toBe("₦2,500.00");
  });

  it("formats negative kobo (e.g. a credit/refund)", () => {
    expect(formatKobo(-500)).toBe("-₦5.00");
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

  it("treats a loan due today as not yet overdue, regardless of local timezone", () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    expect(isLoanOverdue({ due_at: `${yyyy}-${mm}-${dd}`, returned_at: null })).toBe(false);
  });

  it("treats a loan due yesterday as overdue", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yyyy = yesterday.getFullYear();
    const mm = String(yesterday.getMonth() + 1).padStart(2, "0");
    const dd = String(yesterday.getDate()).padStart(2, "0");
    expect(isLoanOverdue({ due_at: `${yyyy}-${mm}-${dd}`, returned_at: null })).toBe(true);
  });

  it("never treats a returned loan as overdue", () => {
    expect(isLoanOverdue({ due_at: "2020-01-01", returned_at: "2020-01-02T00:00:00Z" })).toBe(
      false
    );
  });
});
