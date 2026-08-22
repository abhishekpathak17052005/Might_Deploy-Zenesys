import { daysBetween, parseDate, sameVendor } from "../anomaly.helpers";
import type { HistoricalInvoice, InvoiceInput } from "../anomaly.types";

export function findRelatedSplitInvoiceCandidates(
  invoice: InvoiceInput,
  historicalInvoices: HistoricalInvoice[],
  approvalThreshold: number,
  timeWindowDays: number
): HistoricalInvoice[] {
  const invoiceDate = parseDate(invoice.invoiceDate);
  if (!invoiceDate) return [];

  return historicalInvoices.filter((candidate) => {
    const candidateDate = parseDate(candidate.invoiceDate);
    const samePo =
      (invoice.poId && candidate.poId === invoice.poId) ||
      (invoice.poNumber && candidate.poNumber === invoice.poNumber);
    return (
      sameVendor(invoice, candidate) &&
      samePo &&
      candidateDate !== null &&
      candidate.totalAmount !== undefined &&
      candidate.totalAmount !== null &&
      candidate.totalAmount < approvalThreshold &&
      daysBetween(invoiceDate, candidateDate) <= timeWindowDays
    );
  });
}
