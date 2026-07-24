import { describe, expect, it } from "vitest";
import { buildCsv, escapeCsvField } from "@/lib/csv";

describe("CSV helpers", () => {
  it("guards formula-like values, including those preceded by whitespace", () => {
    expect(escapeCsvField("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(escapeCsvField(" +123")).toBe("' +123");
    expect(escapeCsvField("normal text")).toBe("normal text");
  });

  it("quotes commas, new lines, and quote characters", () => {
    expect(escapeCsvField('Ada, "A"')).toBe('"Ada, ""A"""');
    expect(escapeCsvField("first\nsecond")).toBe('"first\nsecond"');
  });

  it("builds headers and rows using the same escaping rules", () => {
    expect(buildCsv(["Name", "Score"], [["Ada", 90], ["=cmd", 75]])).toBe(
      "Name,Score\nAda,90\n'=cmd,75"
    );
  });
});
