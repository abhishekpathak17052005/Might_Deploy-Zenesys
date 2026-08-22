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
  method?: "RULE_BASED" | "LLM";
  matchedSignals?: string[];
  provider: "gemini" | "DETERMINISTIC";
  model: string;
  categorizedAt: Date;
  glAccount?: string;
}

export interface InvoiceCategorizationProvider {
  categorizeInvoice(input: {
    vendorName: string;
    itemDescriptions: string[];
  }): Promise<unknown>;
}
