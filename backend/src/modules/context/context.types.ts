// ============================================================================
// CONTEXT TYPES
// ============================================================================
// The context module gathers verification data about an invoice submission.
// It does NOT perform anomaly detection — that's the anomaly engine's job.
// It provides the inputs that the anomaly engine needs.

import type { InvoiceDocument, VerificationResult } from "../invoices/invoice.types";

// ============================================================================
// VERIFICATION STATE
// ============================================================================

export type VerificationState = "PENDING" | "IN_PROGRESS" | "COMPLETE" | "FAILED";

export interface VerificationAttempt {
  attemptNumber: number;
  startedAt: Date;
  completedAt?: Date;
  status: VerificationState;
  error?: string;
}

// ============================================================================
// VENDOR CONTEXT
// ============================================================================

export interface VendorContext {
  vendorId: string;
  vendorName?: string;
  legalName?: string | null;
  gstin?: string;
  gstinValid?: boolean;
  vendorExists?: boolean;
  vendorActive?: boolean;
  vendorApproved?: boolean;
  vendorTaxRegistered?: boolean;
  bankDetailsVerified?: boolean;
  bankDetailsUpdatedAt?: Date | string | null;
  approvedAt?: Date | string | null;
  createdAt?: Date | string | null;
  historicalInvoiceCount?: number;
  historicalAnomalyRate?: number;
  riskProfile?: "LOW" | "MEDIUM" | "HIGH";
}

// ============================================================================
// PO CONTEXT
// ============================================================================

export interface POContext {
  poId: string;
  poNumber?: string;
  vendorId?: string | null;
  poVendorMatch?: boolean;
  poExists?: boolean;
  poActive?: boolean;
  poAmount?: number;
  remainingAmount?: number | null;
  poQuantity?: number;
  poDate?: Date;
  poDueDate?: Date;
  poStatus?: string;
  lineItems?: Array<{
    id?: string;
    sku?: string | null;
    productCode?: string | null;
    description?: string | null;
    quantity?: number | null;
    amount?: number | null;
  }>;
}

// ============================================================================
// HISTORICAL CONTEXT
// ============================================================================

export interface HistoricalContext {
  vendorId: string;
  invoiceCount?: number;
  anomalyCount?: number;
  averageAmount?: number;
  averageQuantity?: number;
  invoicesLastNDays?: number;
  lastInvoiceDate?: Date;
  duplicateDetectionWindow?: "LAST_7_DAYS" | "LAST_30_DAYS" | "LAST_90_DAYS";
  invoices?: Array<{
    id?: string;
    invoiceNumber?: string | null;
    vendorId?: string | null;
    vendorName?: string | null;
    poId?: string | null;
    poNumber?: string | null;
    totalAmount?: number | null;
    invoiceDate?: string | Date | null;
    gstin?: string | null;
    lineItems?: Array<{
      id?: string;
      sku?: string | null;
      productCode?: string | null;
      description?: string | null;
      quantity?: number | null;
      amount?: number | null;
    }>;
  }>;
  recentInvoices?: Array<{
    id?: string;
    invoiceNumber?: string | null;
    vendorId?: string | null;
    vendorName?: string | null;
    poId?: string | null;
    poNumber?: string | null;
    totalAmount?: number | null;
    invoiceDate?: string | Date | null;
    gstin?: string | null;
    lineItems?: Array<{
      id?: string;
      sku?: string | null;
      productCode?: string | null;
      description?: string | null;
      quantity?: number | null;
      amount?: number | null;
    }>;
  }>;
}

// ============================================================================
// RISK CONTEXT (Complete verification packet for anomaly engine)
// ============================================================================

export interface RiskContext {
  // Document
  invoice: InvoiceDocument;
  
  // Verification results
  verification: VerificationResult;
  
  // Contextual data
  vendor?: VendorContext;
  po?: POContext;
  history?: HistoricalContext;
  
  // Metadata
  contextBuiltAt: Date;
  contextVersion: string;
}

// ============================================================================
// CONTEXT BUILD REQUEST/RESPONSE
// ============================================================================

export interface BuildRiskContextRequest {
  invoiceId: string;
  vendorId?: string;
  poId?: string;
}

export interface BuildRiskContextResponse {
  invoiceId: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  context?: RiskContext;
  errors?: Array<{
    step: string;
    message: string;
  }>;
}
