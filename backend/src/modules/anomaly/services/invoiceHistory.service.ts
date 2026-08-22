import type { HistoricalInvoice, InvoiceInput } from "../anomaly.types";

export function filterVendorHistory(invoice: InvoiceInput, invoices: HistoricalInvoice[]): HistoricalInvoice[] {
  return invoices.filter((item) => {
    if (invoice.vendorId && item.vendorId) return invoice.vendorId === item.vendorId;
    return invoice.vendorName && item.vendorName && invoice.vendorName.trim().toLowerCase() === item.vendorName.trim().toLowerCase();
  });
}
