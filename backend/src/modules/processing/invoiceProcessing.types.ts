import type { AnomalyResult, AnomalySignal, HistoricalInvoice, LineItemContext } from "../anomaly/anomaly.types";
import type { InvoiceCategorization } from "../categorization";
import type { RiskContext } from "../context";
import type { ExtractionResult, StructuredInvoiceData } from "../extraction";
import type { InvoiceDocument } from "../invoices/invoice.types";

export const PROCESSING_CATEGORY_CODES = [
  "IT_EQUIPMENT",
  "SOFTWARE_SAAS",
  "OFFICE_SUPPLIES",
  "TRAVEL",
  "PROFESSIONAL_SERVICES",
  "UTILITIES",
  "MAINTENANCE",
  "MARKETING",
  "OTHER"
] as const;

export type ProcessingCategoryCode = typeof PROCESSING_CATEGORY_CODES[number];

export type GstinVerificationStatus =
  | "VALID_FORMAT"
  | "INVALID_FORMAT"
  | "VENDOR_MATCH"
  | "VENDOR_MISMATCH"
  | "OFFICIAL_VERIFICATION_UNAVAILABLE";

export interface ProcessingVendor {
  id: string;
  name: string;
  legalName?: string | null;
  gstin?: string | null;
  email?: string | null;
  isActive: boolean;
  isApproved: boolean;
  bankDetailsVerified?: boolean;
  bankDetailsUpdatedAt?: Date | string | null;
  approvedAt?: Date | string | null;
  createdAt?: Date | string | null;
}

export interface ProcessingPurchaseOrder {
  id: string;
  poNumber: string;
  vendorId: string;
  totalAmount: number;
  remainingAmount?: number | null;
  status: "OPEN" | "CLOSED" | "CANCELLED";
  poDate?: Date | string | null;
  lineItems: LineItemContext[];
}

export interface VendorVerificationResult {
  vendorExists: boolean;
  activeStatus: boolean;
  approvedStatus: boolean;
  vendorIdentityMatch: boolean;
  gstinMatch: boolean;
  matchedVendorId?: string;
  evidence: Array<Record<string, unknown>>;
}

export interface GstinVerificationResult {
  statuses: GstinVerificationStatus[];
  formatValid: boolean;
  vendorMatch: boolean;
  officialVerificationAvailable: false;
  evidence: Array<Record<string, unknown>>;
}

export interface PoVerificationResult {
  poExists: boolean;
  poBelongsToVendor: boolean;
  invoiceAmountWithinPo: boolean;
  remainingPoAmountSufficient: boolean;
  quantityWithinPo: boolean;
  previousInvoices: HistoricalInvoice[];
  matchedPoId?: string;
  evidence: Array<Record<string, unknown>>;
}

export interface FinanceNotification {
  id: string;
  toRole: "FINANCE_MANAGER";
  subject: string;
  payload: {
    invoiceId: string;
    riskLevel: string;
    riskScore: number;
    signalCount: number;
  };
  queuedAt: Date;
  provider: "mock";
  status: "QUEUED";
}

export interface InvoiceProcessingEvidence {
  validation: Array<Record<string, unknown>>;
  vendorVerification: Array<Record<string, unknown>>;
  gstVerification: Array<Record<string, unknown>>;
  poVerification: Array<Record<string, unknown>>;
  riskSignals: Array<AnomalySignal & { explanation?: unknown }>;
  explanation: unknown;
}

export interface InvoiceProcessingResponse {
  invoiceId: string;
  status: "FINANCE_REVIEW_PENDING";
  extraction: ExtractionResult;
  category: {
    code: ProcessingCategoryCode;
    source: InvoiceCategorization;
  };
  validation: ExtractionResult["validation"];
  vendorVerification: VendorVerificationResult;
  gstVerification: GstinVerificationResult;
  poVerification: PoVerificationResult;
  risk: {
    score: number;
    level: string;
    decision: string;
    findings: AnomalyResult["signals"];
    metadata: AnomalyResult["metadata"];
  };
  evidence: InvoiceProcessingEvidence;
  notification: FinanceNotification;
}

export interface InvoiceProcessingRepository {
  getInvoiceDocument(documentId: string): Promise<InvoiceDocument | null>;
  getDocumentBuffer(document: InvoiceDocument): Promise<Buffer>;
  updateInvoiceAfterExtraction(
    document: InvoiceDocument,
    extraction: ExtractionResult,
    category: InvoiceCategorization,
    attempts: number
  ): Promise<InvoiceDocument>;
  updateInvoiceProcessingResult(
    invoiceId: string,
    update: Partial<InvoiceDocument> & { riskContext?: RiskContext; evidence?: InvoiceProcessingEvidence }
  ): Promise<void>;
  findVendorForInvoice(invoice: StructuredInvoiceData, existingVendorId?: string | null): Promise<ProcessingVendor | null>;
  findPurchaseOrderForInvoice(invoice: StructuredInvoiceData): Promise<ProcessingPurchaseOrder | null>;
  findHistoricalInvoices(vendorId: string, currentInvoiceId: string): Promise<HistoricalInvoice[]>;
  findPreviousInvoicesForPo(vendorId: string, poIdOrNumber: string, currentInvoiceId: string): Promise<HistoricalInvoice[]>;
}

export interface EmailProvider {
  notifyFinanceManager(input: {
    invoiceId: string;
    riskLevel: string;
    riskScore: number;
    signalCount: number;
  }): Promise<FinanceNotification>;
}
