/**
 * API Contract for invoice processing results.
 * Defines the exact response structure returned by POST /api/invoices/:documentId/process
 */

import { z } from "zod";

export const processingResultSchema = z.object({
  success: z.boolean(),
  invoiceId: z.string(),
  status: z.enum([
    "EXTRACTION_COMPLETE",
    "CATEGORIZATION_COMPLETE",
    "VERIFICATION_COMPLETE",
    "RISK_EVALUATED",
    "PROCESSING_FAILED"
  ]),

  extraction: z.object({
    invoiceNumber: z.string().optional(),
    vendorName: z.string().optional(),
    amount: z.number(),
    invoiceDate: z.string().optional(),
    poNumber: z.string().optional(),
    gstin: z.string().optional()
  }),

  categorization: z.object({
    category: z.string(),
    confidence: z.number(),
    glAccount: z.string().optional(),
    method: z.string()
  }),

  verification: z.object({
    vendor: z.object({
      exists: z.boolean(),
      active: z.boolean(),
      approved: z.boolean(),
      message: z.string()
    }),
    gst: z.object({
      formatValid: z.boolean(),
      vendorMatch: z.boolean(),
      message: z.string(),
      officialVerificationAvailable: z.boolean()
    }),
    po: z.object({
      found: z.boolean(),
      vendorMatch: z.boolean(),
      amountWithinBalance: z.boolean(),
      message: z.string()
    })
  }),

  erp: z.object({
    source: z.string(),
    vendor: z.record(z.unknown()).optional(),
    purchaseOrder: z.record(z.unknown()).optional(),
    glAccount: z.record(z.unknown()).optional()
  }),

  risk: z.object({
    score: z.number(),
    level: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    decision: z.enum(["ELIGIBLE_FOR_AUTO_PROCESSING", "REVIEW_REQUIRED", "BLOCKED"]),
    signals: z.array(
      z.object({
        rule: z.string(),
        severity: z.string(),
        message: z.string()
      })
    )
  }),

  evidence: z.array(
    z.object({
      type: z.string(),
      rule: z.string().optional(),
      severity: z.string().optional(),
      title: z.string(),
      message: z.string(),
      data: z.record(z.unknown()).optional()
    })
  ),

  warnings: z.array(z.string()),
  errors: z.array(z.string())
});

export type ProcessingResult = z.infer<typeof processingResultSchema>;

/**
 * Finance review queue item.
 */
export const financeReviewItemSchema = z.object({
  documentId: z.string(),
  invoiceNumber: z.string(),
  vendorName: z.string(),
  amount: z.number(),
  category: z.string(),
  riskScore: z.number(),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  status: z.string(),
  submittedDate: z.string(),
  processingCompletedDate: z.string().optional()
});

export type FinanceReviewItem = z.infer<typeof financeReviewItemSchema>;

/**
 * Procurement dashboard data.
 */
export const procurementDashboardSchema = z.object({
  totalSubmitted: z.number(),
  processing: z.number(),
  financeReview: z.number(),
  approved: z.number(),
  rejected: z.number(),
  recentInvoices: z.array(
    z.object({
      documentId: z.string(),
      invoiceNumber: z.string(),
      vendor: z.string(),
      amount: z.number(),
      status: z.string(),
      submittedDate: z.string()
    })
  )
});

export type ProcurementDashboard = z.infer<typeof procurementDashboardSchema>;

/**
 * Finance dashboard KPIs.
 */
export const financeDashboardSchema = z.object({
  totalInvoices: z.number(),
  pendingReview: z.number(),
  highRisk: z.number(),
  approved: z.number(),
  rejected: z.number(),
  averageRiskScore: z.number(),
  processingTimeAvgMinutes: z.number()
});

export type FinanceDashboard = z.infer<typeof financeDashboardSchema>;
