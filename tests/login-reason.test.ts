import { describe, expect, it } from "vitest";
import { loginReasonMessage } from "@/lib/loginReason";

describe("loginReasonMessage", () => {
  it("explains the support-session and deactivated redirects", () => {
    expect(loginReasonMessage("support-session-ended")).toMatch(/support session has ended/i);
    expect(loginReasonMessage("deactivated")).toMatch(/deactivated/i);
  });
  it("shows nothing for missing or unknown reasons, and never echoes the value", () => {
    expect(loginReasonMessage(null)).toBeNull();
    expect(loginReasonMessage("")).toBeNull();
    expect(loginReasonMessage("<script>alert(1)</script>")).toBeNull();
    expect(loginReasonMessage("constructor")).toBeNull();
    expect(loginReasonMessage("__proto__")).toBeNull();
  });
});
