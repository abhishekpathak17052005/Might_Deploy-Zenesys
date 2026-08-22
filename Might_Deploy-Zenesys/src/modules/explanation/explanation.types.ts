// ============================================================================
// EXPLANATION TYPES
// ============================================================================
// Converts anomaly signals to human-readable deterministic explanations.
// No LLM — pure pattern matching on signal types and evidence.

import type { AnomalySignal, AnomalyResult } from "../anomaly/anomaly.types";

/**
 * Explanation for a single signal.
 */
export interface SignalExplanation {
  signalType: string;
  severity: string;
  title: string;
  explanation: string;
  recommendation: string;
  evidenceText?: string; // Human-readable evidence summary
}

/**
 * Complete explanation packet for an invoice's anomaly result.
 */
export interface InvoiceExplanation {
  invoiceId: string;
  overallRiskLevel: string;
  overallDecision: string;
  summary: string;
  signals: SignalExplanation[];
  nextSteps: string[];
  createdAt: Date;
}

/**
 * Request to generate explanation.
 */
export interface ExplainAnomalyRequest {
  anomalyResult: AnomalyResult;
  invoiceId: string;
}

/**
 * Response with explanation.
 */
export interface ExplainAnomalyResponse {
  invoiceId: string;
  explanation: InvoiceExplanation;
}
