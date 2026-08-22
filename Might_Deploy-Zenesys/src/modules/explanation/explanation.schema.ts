import { z } from "zod";

// ============================================================================
// EXPLANATION SCHEMAS
// ============================================================================

export const signalExplanationSchema = z.object({
  signalType: z.string(),
  severity: z.string(),
  title: z.string(),
  explanation: z.string(),
  recommendation: z.string(),
  evidenceText: z.string().optional()
});

export const invoiceExplanationSchema = z.object({
  invoiceId: z.string(),
  overallRiskLevel: z.string(),
  overallDecision: z.string(),
  summary: z.string(),
  signals: z.array(signalExplanationSchema),
  nextSteps: z.array(z.string()),
  createdAt: z.unknown()
});

export const explainAnomalyRequestSchema = z.object({
  anomalyResult: z.unknown(),
  invoiceId: z.string()
});

export const explainAnomalyResponseSchema = z.object({
  invoiceId: z.string(),
  explanation: invoiceExplanationSchema
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type SignalExplanation = z.infer<typeof signalExplanationSchema>;
export type InvoiceExplanation = z.infer<typeof invoiceExplanationSchema>;
export type ExplainAnomalyRequest = z.infer<typeof explainAnomalyRequestSchema>;
export type ExplainAnomalyResponse = z.infer<typeof explainAnomalyResponseSchema>;
