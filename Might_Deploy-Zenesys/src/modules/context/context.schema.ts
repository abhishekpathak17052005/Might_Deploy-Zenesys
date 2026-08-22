import { z } from "zod";
import { verificationResultSchema } from "../invoices/invoice.schema";

// ============================================================================
// VENDOR CONTEXT SCHEMA
// ============================================================================

export const vendorContextSchema = z.object({
  vendorId: z.string(),
  vendorName: z.string().optional(),
  gstin: z.string().optional(),
  gstinValid: z.boolean().optional(),
  vendorExists: z.boolean().optional(),
  vendorActive: z.boolean().optional(),
  vendorTaxRegistered: z.boolean().optional(),
  historicalInvoiceCount: z.number().optional(),
  historicalAnomalyRate: z.number().optional(),
  riskProfile: z.enum(["LOW", "MEDIUM", "HIGH"]).optional()
});

// ============================================================================
// PO CONTEXT SCHEMA
// ============================================================================

export const poContextSchema = z.object({
  poId: z.string(),
  poNumber: z.string().optional(),
  poVendorMatch: z.boolean().optional(),
  poExists: z.boolean().optional(),
  poActive: z.boolean().optional(),
  poAmount: z.number().optional(),
  poQuantity: z.number().optional(),
  poDate: z.unknown().optional(),
  poDueDate: z.unknown().optional(),
  poStatus: z.string().optional()
});

// ============================================================================
// HISTORICAL CONTEXT SCHEMA
// ============================================================================

export const historicalContextSchema = z.object({
  vendorId: z.string(),
  invoiceCount: z.number().optional(),
  anomalyCount: z.number().optional(),
  averageAmount: z.number().optional(),
  averageQuantity: z.number().optional(),
  invoicesLastNDays: z.number().optional(),
  lastInvoiceDate: z.unknown().optional(),
  duplicateDetectionWindow: z.enum(["LAST_7_DAYS", "LAST_30_DAYS", "LAST_90_DAYS"]).optional()
});

// ============================================================================
// RISK CONTEXT SCHEMA
// ============================================================================

export const riskContextSchema = z.object({
  invoice: z.unknown(), // InvoiceDocumentSchema - avoid circular dependency
  verification: verificationResultSchema,
  vendor: vendorContextSchema.optional(),
  po: poContextSchema.optional(),
  history: historicalContextSchema.optional(),
  contextBuiltAt: z.unknown(),
  contextVersion: z.string()
});

// ============================================================================
// API SCHEMAS
// ============================================================================

export const buildRiskContextRequestSchema = z.object({
  invoiceId: z.string(),
  vendorId: z.string().optional(),
  poId: z.string().optional()
});

export const buildRiskContextResponseSchema = z.object({
  invoiceId: z.string(),
  status: z.enum(["SUCCESS", "PARTIAL", "FAILED"]),
  context: riskContextSchema.optional(),
  errors: z.array(z.object({
    step: z.string(),
    message: z.string()
  })).optional()
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type VendorContextDto = z.infer<typeof vendorContextSchema>;
export type POContextDto = z.infer<typeof poContextSchema>;
export type HistoricalContextDto = z.infer<typeof historicalContextSchema>;
export type RiskContextDto = z.infer<typeof riskContextSchema>;
export type BuildRiskContextRequest = z.infer<typeof buildRiskContextRequestSchema>;
export type BuildRiskContextResponse = z.infer<typeof buildRiskContextResponseSchema>;
