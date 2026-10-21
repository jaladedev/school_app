import { describe, expect, it } from "vitest";
import {
  allowsCard,
  allowsTransfer,
  claimPaymentReference,
  invoiceReference,
  koboToNairaInput,
  nairaToKobo,
  normalizePaymentMethods,
  readBankDetails,
  validateClaimInput,
  validatePaymentSettings,
} from "@/lib/paymentClaims";

describe("payment methods", () => {
  it("defaults to both when missing or unknown", () => {
    expect(normalizePaymentMethods(undefined)).toBe("both");
    expect(normalizePaymentMethods(null)).toBe("both");
    expect(normalizePaymentMethods("cash")).toBe("both");
  });

  it("maps each setting to the methods it shows", () => {
    expect([allowsCard("paystack"), allowsTransfer("paystack")]).toEqual([true, false]);
    expect([allowsCard("transfer"), allowsTransfer("transfer")]).toEqual([false, true]);
    expect([allowsCard("both"), allowsTransfer("both")]).toEqual([true, true]);
  });
});

describe("readBankDetails", () => {
  it("needs all three parts", () => {
    expect(readBankDetails(null)).toBeNull();
    expect(readBankDetails({ bank_name: "GTBank", bank_account_name: "School" })).toBeNull();
    expect(
      readBankDetails({
        bank_name: " ",
        bank_account_name: "School",
        bank_account_number: "0123456789",
      })
    ).toBeNull();
    expect(
      readBankDetails({
        bank_name: "GTBank ",
        bank_account_name: "School",
        bank_account_number: "0123456789",
      })
    ).toEqual({ bankName: "GTBank", accountName: "School", accountNumber: "0123456789" });
  });
});

describe("references", () => {
  it("derives a stable narration code from the invoice id", () => {
    const id = "3f2a9c1e-7b44-4d0a-9e11-0123456789ab";
    expect(invoiceReference(id)).toBe("INV-3F2A9C1E");
    expect(invoiceReference(id)).toBe(invoiceReference(id));
  });

  it("gives each claim its own payment reference, so a second partial payment never collides", () => {
    expect(claimPaymentReference("abc")).toBe("claim:abc");
    expect(claimPaymentReference("abc")).not.toBe(claimPaymentReference("abd"));
  });
});

describe("naira and kobo", () => {
  it.each([
    ["25000", 2_500_000],
    ["25,000", 2_500_000],
    ["₦25,000.50", 2_500_050],
    ["0.5", 50],
  ])("parses %s", (text, kobo) => {
    expect(nairaToKobo(text)).toBe(kobo);
  });

  it.each(["", "abc", "0", "-5", "1.234", "1e5"])("rejects %j", (text) => {
    expect(nairaToKobo(text)).toBeNull();
  });

  it("formats kobo for an input box", () => {
    expect(koboToNairaInput(2_500_000)).toBe("25000");
    expect(koboToNairaInput(2_500_050)).toBe("25000.50");
  });
});

describe("validateClaimInput", () => {
  const base = {
    amountKobo: 1_000_000,
    balanceKobo: 5_000_000,
    sentOn: "2026-10-20",
    senderName: "Ada Obi",
    today: "2026-10-21",
  };

  it("accepts a normal claim, including part payment and a full balance", () => {
    expect(validateClaimInput(base)).toBeNull();
    expect(validateClaimInput({ ...base, amountKobo: 5_000_000 })).toBeNull();
    expect(validateClaimInput({ ...base, sentOn: "2026-10-21" })).toBeNull();
  });

  it("refuses an amount over the balance, zero, or fractional kobo", () => {
    expect(validateClaimInput({ ...base, amountKobo: 5_000_001 })).toMatch(/more than/);
    expect(validateClaimInput({ ...base, amountKobo: 0 })).toMatch(/amount/);
    expect(validateClaimInput({ ...base, amountKobo: 10.5 })).toMatch(/amount/);
  });

  it("needs a sender name", () => {
    expect(validateClaimInput({ ...base, senderName: "   " })).toMatch(/name/);
  });

  it("refuses a bad, future or stale date", () => {
    expect(validateClaimInput({ ...base, sentOn: "20/10/2026" })).toMatch(/date/);
    expect(validateClaimInput({ ...base, sentOn: "2026-02-31" })).toMatch(/date/);
    expect(validateClaimInput({ ...base, sentOn: "2026-10-22" })).toMatch(/future/);
    expect(validateClaimInput({ ...base, sentOn: "2026-07-01" })).toMatch(/90 days/);
  });
});

describe("validatePaymentSettings", () => {
  const bank = { bankName: "GTBank", accountName: "School", accountNumber: "0123456789" };
  const none = { bankName: "", accountName: "", accountNumber: "" };

  it("lets a card-only school leave the bank empty", () => {
    expect(
      validatePaymentSettings({ paymentMethods: "paystack", ...none, notifyChatId: "" })
    ).toBeNull();
  });

  it("requires full bank details when transfer is on", () => {
    expect(validatePaymentSettings({ paymentMethods: "both", ...none, notifyChatId: "" })).toMatch(
      /bank name, account name and account number/
    );
    expect(
      validatePaymentSettings({
        paymentMethods: "transfer",
        ...bank,
        accountName: "",
        notifyChatId: "",
      })
    ).toMatch(/bank name/);
  });

  it("rejects half-filled bank details even with transfer off", () => {
    expect(
      validatePaymentSettings({
        paymentMethods: "paystack",
        ...none,
        bankName: "GTBank",
        notifyChatId: "",
      })
    ).toMatch(/all three/);
  });

  it("checks the account number and chat id formats", () => {
    expect(
      validatePaymentSettings({
        paymentMethods: "both",
        ...bank,
        accountNumber: "12345",
        notifyChatId: "",
      })
    ).toMatch(/10 digits/);
    expect(
      validatePaymentSettings({ paymentMethods: "both", ...bank, notifyChatId: "abc" })
    ).toMatch(/chat id/);
    expect(
      validatePaymentSettings({ paymentMethods: "both", ...bank, notifyChatId: "-1001234567" })
    ).toBeNull();
  });
});
