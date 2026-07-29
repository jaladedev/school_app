import { describe, expect, it } from "vitest";
import { computeWordDiff } from "@/lib/diff";

function reconstruct(tokens: ReturnType<typeof computeWordDiff>, keep: ("equal" | "added")[]) {
  return tokens
    .filter((t) => keep.includes(t.type as any))
    .map((t) => t.text)
    .join("");
}

describe("computeWordDiff", () => {
  it("returns a single equal token for identical text", () => {
    const tokens = computeWordDiff("the quick fox", "the quick fox");
    expect(tokens).toEqual([{ type: "equal", text: "the quick fox" }]);
  });

  it("marks an inserted word as added without disturbing the rest", () => {
    const tokens = computeWordDiff("the fox jumps", "the quick fox jumps");
    expect(tokens.some((t) => t.type === "added" && t.text.includes("quick"))).toBe(true);
    // Reconstructing from equal+added tokens should give back the new text exactly.
    expect(reconstruct(tokens, ["equal", "added"])).toBe("the quick fox jumps");
  });

  it("marks a removed word as removed", () => {
    const tokens = computeWordDiff("the quick fox jumps", "the fox jumps");
    expect(tokens.some((t) => t.type === "removed" && t.text.includes("quick"))).toBe(true);
  });

  it("handles a full word replacement (both words removed, both words added)", () => {
    const tokens = computeWordDiff("hello world", "goodbye moon");
    // The single space between the two words is identical on both
    // sides, so it correctly comes back as "equal" -- only the actual
    // words should be removed/added.
    expect(tokens.some((t) => t.type === "removed" && t.text.includes("hello"))).toBe(true);
    expect(tokens.some((t) => t.type === "removed" && t.text.includes("world"))).toBe(true);
    expect(tokens.some((t) => t.type === "added" && t.text.includes("goodbye"))).toBe(true);
    expect(tokens.some((t) => t.type === "added" && t.text.includes("moon"))).toBe(true);
    expect(reconstruct(tokens, ["equal", "added"])).toBe("goodbye moon");
  });

  it("handles empty strings without throwing", () => {
    expect(computeWordDiff("", "")).toEqual([]);
    expect(computeWordDiff("", "new text")).toEqual([{ type: "added", text: "new text" }]);
    expect(computeWordDiff("old text", "")).toEqual([{ type: "removed", text: "old text" }]);
  });

  it("preserves original spacing so concatenating equal+added tokens round-trips exactly", () => {
    const oldText = "line one\n\nline two with  double space";
    const newText = "line one\n\nline two with  double space, extended";
    const tokens = computeWordDiff(oldText, newText);
    expect(reconstruct(tokens, ["equal", "added"])).toBe(newText);
  });
});
