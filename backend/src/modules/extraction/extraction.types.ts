export type FieldExtractionStatus = "EXTRACTED" | "MISSING" | "UNCERTAIN";

export interface FieldExtraction<T> {
  value: T | null;
  confidence?: number;
  status: FieldExtractionStatus;
}

export interface ExtractedInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number | null;
  amount: number;
}

export interface StructuredInvoiceData {
  invoiceNumber: string;
  invoiceDate: Date;
  vendorName: string;
  gstin?: string | null;
  poNumber?: string | null;
  subtotal: number;
  tax: number;
  total: number;
  dueDate?: Date | null;
  items: ExtractedInvoiceItem[];
}

export interface ExtractionConfidence {
  invoiceNumber: FieldExtraction<string>;
  invoiceDate: FieldExtraction<string>;
  vendorName: FieldExtraction<string>;
  gstin: FieldExtraction<string>;
  poNumber: FieldExtraction<string>;
  subtotal: FieldExtraction<number>;
  tax: FieldExtraction<number>;
  total: FieldExtraction<number>;
  dueDate: FieldExtraction<string>;
}

export type ExtractionFindingType =
  | "EXTRACTION_SCHEMA_ERROR"
  | "EXTRACTION_MATH_ERROR"
  | "LINE_ITEM_AMOUNT_MISMATCH"
  | "SUBTOTAL_MISMATCH"
  | "TOTAL_MISMATCH"
  | "NEGATIVE_VALUE"
  | "INVALID_DATE"
  | "GSTIN_FORMAT_INVALID"
  | "LOW_CONFIDENCE";

export interface ExtractionValidationFinding {
  type: ExtractionFindingType;
  field?: string;
  message: string;
  expected?: number | string;
  actual?: number | string;
  difference?: number;
  evidence?: Record<string, unknown>;
}

export interface ExtractionValidationResult {
  status: "VALID" | "INVALID";
  findings: ExtractionValidationFinding[];
}

export interface ExtractionResult {
  raw: unknown;
  invoice: StructuredInvoiceData;
  confidence: ExtractionConfidence;
  validation: ExtractionValidationResult;
  provider: "gemini";
  model: string;
  extractedAt: Date;
}

export interface InvoiceExtractionProvider {
  extractInvoice(input: {
    documentBuffer: Buffer;
    mimeType: string;
    filename: string;
  }): Promise<unknown>;
}
