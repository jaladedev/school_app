// Pure helpers for manual bank transfer claims (plan section 5.7, part A).
// No server imports, so client components and unit tests can use it.

export type PaymentMethods = "paystack" | "transfer" | "both";

export type PaymentClaimStatus = "pending" | "confirmed" | "rejected";

export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethods; label: string }[] = [
  { value: "both", label: "Card online and bank transfer" },
  { value: "paystack", label: "Card online only" },
  { value: "transfer", label: "Bank transfer only" },
];

/** A missing or unknown value reads as "both", the default. */
export function normalizePaymentMethods(value: unknown): PaymentMethods {
  return value === "paystack" || value === "transfer" || value === "both" ? value : "both";
}

export function allowsCard(methods: PaymentMethods): boolean {
  return methods === "paystack" || methods === "both";
}

export function allowsTransfer(methods: PaymentMethods): boolean {
  return methods === "transfer" || methods === "both";
}

export interface BankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
}

/** Bank details only count when all three parts are filled in. */
export function readBankDetails(
  settings:
    | {
        bank_name?: string | null;
        bank_account_name?: string | null;
        bank_account_number?: string | null;
      }
    | null
    | undefined
): BankDetails | null {
  const bankName = settings?.bank_name?.trim();
  const accountName = settings?.bank_account_name?.trim();
  const accountNumber = settings?.bank_account_number?.trim();
  if (!bankName || !accountName || !accountNumber) return null;
  return { bankName, accountName, accountNumber };
}

/** Nigerian bank account numbers (NUBAN) are exactly 10 digits. */
export function isValidAccountNumber(value: string): boolean {
  return /^\d{10}$/.test(value.trim());
}

/**
 * The code a payer puts in the transfer narration. Derived from the invoice id
 * so it is stable, needs no counter, and a bursar can match it on a statement.
 */
export function invoiceReference(invoiceId: string): string {
  return `INV-${invoiceId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

/** The reference stored on the payment a confirmed claim creates (unique per claim). */
export function claimPaymentReference(claimId: string): string {
  return `claim:${claimId}`;
}

const MAX_CLAIM_AGE_DAYS = 90;

/** Today's date in Lagos as YYYY-MM-DD, whatever timezone the server runs in. */
export function lagosToday(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
}

export function validateClaimInput(input: {
  amountKobo: number;
  balanceKobo: number;
  sentOn: string;
  senderName: string;
  today?: string;
}): string | null {
  const { amountKobo, balanceKobo, sentOn, senderName } = input;
  const today = input.today ?? lagosToday();

  if (!Number.isInteger(amountKobo) || amountKobo <= 0) {
    return "Enter the amount you sent.";
  }
  if (amountKobo > balanceKobo) {
    return "The amount is more than what is still owed on this invoice.";
  }
  if (!senderName.trim()) {
    return "Enter the name on the account the money was sent from.";
  }
  if (senderName.trim().length > 120) {
    return "That sender name is too long.";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sentOn) || Number.isNaN(Date.parse(`${sentOn}T00:00:00Z`))) {
    return "Enter the date you sent the transfer.";
  }
  if (sentOn > today) {
    return "The transfer date can't be in the future.";
  }
  const ageDays =
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${sentOn}T00:00:00Z`)) / 86_400_000;
  if (ageDays > MAX_CLAIM_AGE_DAYS) {
    return `The transfer date is more than ${MAX_CLAIM_AGE_DAYS} days ago. Take the receipt to the school office instead.`;
  }
  return null;
}

/** Validates the bank and method settings an admin saves. */
export function validatePaymentSettings(input: {
  paymentMethods: PaymentMethods;
  bankName: string;
  accountName: string;
  accountNumber: string;
  notifyChatId: string;
}): string | null {
  const anyBank = input.bankName.trim() || input.accountName.trim() || input.accountNumber.trim();
  if (allowsTransfer(input.paymentMethods) || anyBank) {
    if (!input.bankName.trim() || !input.accountName.trim() || !input.accountNumber.trim()) {
      return allowsTransfer(input.paymentMethods)
        ? "Bank transfer needs the bank name, account name and account number."
        : "Fill in all three bank fields, or clear them all.";
    }
    if (!isValidAccountNumber(input.accountNumber)) {
      return "The account number must be exactly 10 digits.";
    }
  }
  const chat = input.notifyChatId.trim();
  if (chat && !/^-?\d{4,20}$/.test(chat)) {
    return "The Telegram chat id is a number (it may start with a minus sign).";
  }
  return null;
}

/** Parses a naira amount typed by a person ("25,000" or "25000.50") into kobo, or null. */
export function nairaToKobo(text: string): number | null {
  const cleaned = text.replace(/[,\s₦]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const kobo = Math.round(Number(cleaned) * 100);
  return Number.isSafeInteger(kobo) && kobo > 0 ? kobo : null;
}

export function koboToNairaInput(kobo: number): string {
  return (kobo / 100).toFixed(2).replace(/\.00$/, "");
}
