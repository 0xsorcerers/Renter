import type { Period } from "./api";

export function formatAmount(amount: number, currency?: string) {
  const zeroDecimal = ["JPY", "KRW", "VND", "IDR", "NGN", "UGX", "TZS", "RWF", "XOF", "XAF", "CLP", "HUF"];
  const digits = zeroDecimal.includes(currency ?? "") || Number.isInteger(amount) ? 0 : 2;
  try {
    return amount.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  } catch {
    return String(amount);
  }
}

export function formatPrice(amount: number, symbol: string, currency?: string) {
  return `${symbol}${formatAmount(amount, currency)}`;
}

export const PERIOD_LABEL: Record<Period, string> = {
  week: "per week",
  month: "per month",
  year: "per year",
};

export const PERIOD_SHORT: Record<Period, string> = {
  week: "/ wk",
  month: "/ mo",
  year: "/ yr",
};

export const PERIOD_TITLE: Record<Period, string> = {
  week: "Weekly",
  month: "Monthly",
  year: "Yearly",
};
