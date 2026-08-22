export type InvoiceType = "PO_BASED" | "NON_PO";

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type RiskLevel = Severity;

export type DecisionStatus = "ELIGIBLE_FOR_AUTO_PROCESSING" | "REVIEW_REQUIRED" | "BLOCKED";

export type EvaluationStatus = "EVALUATED" | "NOT_EVALUATED";

export type AnomalyType =
  | "DUPLICATE_INVOICE"
  | "POTENTIAL_DUPLICATE_INVOICE"
  | "SIMILAR_INVOICE"
  | "PO_NOT_FOUND"
  | "MISSING_PO_REFERENCE"
  | "PO_VENDOR_MISMATCH"
  | "AMOUNT_MISMATCH"
  | "QUANTITY_MISMATCH"
  | "VENDOR_NOT_IN_MASTER"
  | "VENDOR_INACTIVE"
  | "VENDOR_GSTIN_MISMATCH"
  | "VENDOR_LEGAL_NAME_MISMATCH"
  | "VENDOR_BANK_DETAILS_UNVERIFIED"
  | "VENDOR_BANK_DETAILS_RECENTLY_CHANGED"
  | "VENDOR_NOT_APPROVED"
  | "VENDOR_MATCH_UNCERTAIN"
  | "UNUSUAL_AMOUNT"
  | "UNUSUAL_LOW_AMOUNT"
  | "AMOUNT_EXCEEDS_HISTORICAL_MAXIMUM"
  | "UNUSUAL_INVOICE_FREQUENCY"
  | "FUTURE_INVOICE_DATE"
  | "INVOICE_DATE_BEFORE_PO"
  | "STALE_INVOICE"
  | "VERY_OLD_INVOICE"
  | "DUE_DATE_BEFORE_INVOICE_DATE"
  | "INVALID_GSTIN_FORMAT"
  | "GSTIN_MISMATCH"
  | "TAX_ARITHMETIC_MISMATCH"
  | "MISSING_TAX_INFORMATION"
  | "ROUND_AMOUNT"
  | "NEAR_APPROVAL_THRESHOLD"
  | "POTENTIAL_SPLIT_INVOICING"
  | "CORRELATED_HIGH_REVIEW_PRIORITY"
  | "RULE_EVALUATION_FAILED";

export interface LineItemContext {
  id?: string;
  sku?: string | null;
  productCode?: string | null;
  description?: string | null;
  quantity?: number | null;
  amount?: number | null;
}

export interface InvoiceInput {
  id?: string;
  invoiceNumber?: string | null;
  invoiceType?: InvoiceType;
  vendorId?: string | null;
  vendorName?: string | null;
  poId?: string | null;
  poNumber?: string | null;
  totalAmount?: number | null;
  subtotal?: number | null;
  taxAmount?: number | null;
  discountAmount?: number | null;
  dueDate?: string | Date | null;
  invoiceDate?: string | Date | null;
  gstin?: string | null;
  billingAddress?: string | null;
  lineItems?: LineItemContext[];
}

export interface VendorContext {
  id?: string;
  name?: string;
  gstin?: string | null;
  isActive?: boolean;
  legalName?: string | null;
  address?: string | null;
  bankDetailsVerified?: boolean;
  bankDetailsUpdatedAt?: string | Date | null;
  isApproved?: boolean;
  approvedAt?: string | Date | null;
  createdAt?: string | Date | null;
}

export interface PurchaseOrderContext {
  id?: string;
  poNumber?: string;
  vendorId?: string | null;
  totalAmount?: number | null;
  poDate?: string | Date | null;
  createdAt?: string | Date | null;
  lineItems?: LineItemContext[];
}

export interface HistoricalInvoice {
  id?: string;
  invoiceNumber?: string | null;
  vendorId?: string | null;
  vendorName?: string | null;
  poId?: string | null;
  poNumber?: string | null;
  totalAmount?: number | null;
  invoiceDate?: string | Date | null;
  gstin?: string | null;
  lineItems?: LineItemContext[];
}

export interface RuleConfig {
  duplicateWindowDays: number;
  amountMismatchTolerancePercentage: number;
  amountMismatchSeverityThresholds: {
    medium: number;
    high: number;
    critical: number;
  };
  missingPoReferenceSeverity: Severity;
  historicalMinimumInvoices: number;
  unusualAmountMultiplier: number;
  staleInvoiceDays: number;
  staleInvoiceSeverity: Severity;
  oldInvoiceDays: number;
  similarInvoiceAmountTolerancePercentage: number;
  vendorBankChangeReviewDays: number;
  taxRequired: boolean;
  taxArithmeticTolerance: number;
  nearApprovalThresholdPercentage: number;
  correlationMinimumSignalCount: number;
  roundAmount: {
    enabled: boolean;
    severity: Severity;
    minimumAmount: number;
  };
  splitInvoiceWindowDays: number;
  splitInvoicePoCoveragePercentage: number;
  approvalThreshold: number;
  severityScores: Record<Severity, number>;
  riskThresholds: {
    low: number;
    medium: number;
    high: number;
  };
  enabledRules: Record<string, boolean>;
}

export interface AnomalyContext {
  invoice: InvoiceInput;
  vendor?: VendorContext;
  purchaseOrder?: PurchaseOrderContext;
  historicalInvoices: HistoricalInvoice[];
  recentInvoices: HistoricalInvoice[];
  ruleConfig: RuleConfig;
  currentDate: Date;
}

export interface AnomalyEvidence {
  field: string;
  actual?: unknown;
  expected?: unknown;
  difference?: number;
  differencePercentage?: number;
}

export interface AnomalySignal {
  ruleId: string;
  type: AnomalyType;
  severity: Severity;
  score: number;
  title: string;
  message: string;
  evidence: AnomalyEvidence[];
  metadata?: Record<string, unknown>;
}

export interface AnomalyRule {
  id: string;
  name: string;
  enabled: boolean;
  evaluate(context: AnomalyContext): Promise<AnomalySignal | null>;
}

export interface AnomalyResult {
  invoiceId?: string;
  risk: {
    score: number;
    level: RiskLevel;
  };
  signals: AnomalySignal[];
  decision: {
    status: DecisionStatus;
    reason: string;
  };
  metadata: {
    evaluatedRuleCount: number;
    signalCount: number;
    executionDurationMs: number;
    ruleFailures: string[];
  };
}
