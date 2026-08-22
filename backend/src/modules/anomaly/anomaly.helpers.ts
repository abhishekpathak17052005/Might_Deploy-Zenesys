import type { AnomalySignal, HistoricalInvoice, InvoiceInput, LineItemContext, Severity } from "./anomaly.types";

export function normalizeText(value?: string | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeGstin(value?: string | null): string {
  return (value ?? "").trim().toUpperCase();
}

export function parseDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

export function signedDaysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
}

export function getVendorKey(invoice: InvoiceInput | HistoricalInvoice): string {
  return invoice.vendorId ?? normalizeText(invoice.vendorName);
}

export function sameVendor(invoice: InvoiceInput, historicalInvoice: HistoricalInvoice): boolean {
  const invoiceVendorId = invoice.vendorId ?? null;
  const historicalVendorId = historicalInvoice.vendorId ?? null;
  if (invoiceVendorId && historicalVendorId) return invoiceVendorId === historicalVendorId;
  return getVendorKey(invoice) !== "" && getVendorKey(invoice) === getVendorKey(historicalInvoice);
}

export function makeSignal(input: Omit<AnomalySignal, "score">, severityScores: Record<Severity, number>): AnomalySignal {
  return {
    ...input,
    score: severityScores[input.severity]
  };
}

export function percent(value: number): number {
  return Math.round(value * 100) / 100;
}

export function amountDifferencePercentage(actual: number, expected: number): number {
  if (expected === 0) return 0;
  return percent((Math.abs(actual - expected) / Math.abs(expected)) * 100);
}

export function isCreditNoteNumber(value?: string | null): boolean {
  const normalized = normalizeText(value);
  return normalized.startsWith("cn-") || normalized.startsWith("credit note") || normalized.startsWith("credit-note");
}

export function areInvoiceNumbersSimilar(a?: string | null, b?: string | null): boolean {
  const left = normalizeText(a).replace(/[^a-z0-9]/g, "");
  const right = normalizeText(b).replace(/[^a-z0-9]/g, "");
  if (!left || !right || left === right) return false;
  if (isCreditNoteNumber(a) || isCreditNoteNumber(b)) return false;
  return left.includes(right) || right.includes(left) || levenshteinDistance(left, right) <= 2;
}

function levenshteinDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

export function getItemMatchKey(item: LineItemContext): string | null {
  const sku = normalizeText(item.sku ?? item.productCode);
  if (sku) return `sku:${sku}`;
  const description = normalizeText(item.description);
  return description ? `description:${description}` : null;
}

export function isValidIndianGstin(gstin?: string | null): boolean {
  const normalized = normalizeGstin(gstin);
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(normalized);
}
