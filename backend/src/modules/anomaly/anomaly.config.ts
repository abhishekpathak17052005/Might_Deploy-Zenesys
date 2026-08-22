import { DEFAULT_SEVERITY_SCORES } from "./anomaly.constants";
import type { RuleConfig, Severity } from "./anomaly.types";

function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function severityFromEnv(name: string, fallback: Severity): Severity {
  const raw = process.env[name];
  return raw === "LOW" || raw === "MEDIUM" || raw === "HIGH" || raw === "CRITICAL" ? raw : fallback;
}

export const defaultAnomalyConfig: RuleConfig = {
  duplicateWindowDays: numberFromEnv("ANOMALY_DUPLICATE_WINDOW_DAYS", 7),
  amountMismatchTolerancePercentage: numberFromEnv("ANOMALY_AMOUNT_TOLERANCE_PERCENTAGE", 5),
  amountMismatchSeverityThresholds: {
    medium: numberFromEnv("ANOMALY_AMOUNT_MEDIUM_PERCENTAGE", 5),
    high: numberFromEnv("ANOMALY_AMOUNT_HIGH_PERCENTAGE", 15),
    critical: numberFromEnv("ANOMALY_AMOUNT_CRITICAL_PERCENTAGE", 30)
  },
  missingPoReferenceSeverity: severityFromEnv("ANOMALY_MISSING_PO_SEVERITY", "MEDIUM"),
  historicalMinimumInvoices: numberFromEnv("ANOMALY_HISTORICAL_MINIMUM_INVOICES", 3),
  unusualAmountMultiplier: numberFromEnv("ANOMALY_UNUSUAL_AMOUNT_MULTIPLIER", 2),
  staleInvoiceDays: numberFromEnv("ANOMALY_STALE_INVOICE_DAYS", 90),
  staleInvoiceSeverity: severityFromEnv("ANOMALY_STALE_INVOICE_SEVERITY", "MEDIUM"),
  oldInvoiceDays: numberFromEnv("ANOMALY_OLD_INVOICE_DAYS", 90),
  similarInvoiceAmountTolerancePercentage: numberFromEnv("ANOMALY_SIMILAR_INVOICE_AMOUNT_TOLERANCE_PERCENTAGE", 2),
  vendorBankChangeReviewDays: numberFromEnv("ANOMALY_VENDOR_BANK_CHANGE_REVIEW_DAYS", 30),
  taxRequired: process.env.ANOMALY_TAX_REQUIRED === "true",
  taxArithmeticTolerance: numberFromEnv("ANOMALY_TAX_ARITHMETIC_TOLERANCE", 1),
  nearApprovalThresholdPercentage: numberFromEnv("ANOMALY_NEAR_APPROVAL_THRESHOLD_PERCENTAGE", 2),
  correlationMinimumSignalCount: numberFromEnv("ANOMALY_CORRELATION_MINIMUM_SIGNAL_COUNT", 3),
  roundAmount: {
    enabled: process.env.ANOMALY_ROUND_AMOUNT_ENABLED !== "false",
    severity: severityFromEnv("ANOMALY_ROUND_AMOUNT_SEVERITY", "LOW"),
    minimumAmount: numberFromEnv("ANOMALY_ROUND_AMOUNT_MINIMUM", 50000)
  },
  splitInvoiceWindowDays: numberFromEnv("ANOMALY_SPLIT_INVOICE_WINDOW_DAYS", 1),
  splitInvoicePoCoveragePercentage: numberFromEnv("ANOMALY_SPLIT_PO_COVERAGE_PERCENTAGE", 90),
  approvalThreshold: numberFromEnv("ANOMALY_APPROVAL_THRESHOLD", 50000),
  severityScores: DEFAULT_SEVERITY_SCORES,
  riskThresholds: {
    low: numberFromEnv("ANOMALY_RISK_LOW_MAX", 20),
    medium: numberFromEnv("ANOMALY_RISK_MEDIUM_MAX", 50),
    high: numberFromEnv("ANOMALY_RISK_HIGH_MAX", 75)
  },
  enabledRules: {}
};

export function mergeAnomalyConfig(overrides?: Partial<RuleConfig>): RuleConfig {
  return {
    ...defaultAnomalyConfig,
    ...overrides,
    amountMismatchSeverityThresholds: {
      ...defaultAnomalyConfig.amountMismatchSeverityThresholds,
      ...overrides?.amountMismatchSeverityThresholds
    },
    roundAmount: {
      ...defaultAnomalyConfig.roundAmount,
      ...overrides?.roundAmount
    },
    severityScores: {
      ...defaultAnomalyConfig.severityScores,
      ...overrides?.severityScores
    },
    riskThresholds: {
      ...defaultAnomalyConfig.riskThresholds,
      ...overrides?.riskThresholds
    },
    enabledRules: {
      ...defaultAnomalyConfig.enabledRules,
      ...overrides?.enabledRules
    }
  };
}
