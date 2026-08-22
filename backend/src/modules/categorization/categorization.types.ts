export const ALLOWED_INVOICE_CATEGORIES = [
  "IT Equipment",
  "Software / SaaS",
  "Office Supplies",
  "Travel",
  "Professional Services",
  "Utilities",
  "Maintenance",
  "Marketing",
  "Other"
] as const;

export type InvoiceCategory = typeof ALLOWED_INVOICE_CATEGORIES[number];

export interface InvoiceCategorization {
  category: InvoiceCategory;
  confidence: number;
  reason: string;
  status: "HIGH_CONFIDENCE" | "LOW_CONFIDENCE" | "FAILED";
  provider: "gemini";
  model: string;
  categorizedAt: Date;
}

export interface InvoiceCategorizationProvider {
  categorizeInvoice(input: {
    vendorName: string;
    itemDescriptions: string[];
  }): Promise<unknown>;
}
