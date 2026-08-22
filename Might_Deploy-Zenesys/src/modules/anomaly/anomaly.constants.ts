import type { Severity } from "./anomaly.types";

export const ANOMALY_RULE_IDS = {
  duplicateInvoice: "DUPLICATE_INVOICE",
  poNotFound: "PO_NOT_FOUND",
  amountMismatch: "AMOUNT_MISMATCH",
  quantityMismatch: "QUANTITY_MISMATCH",
  vendorVerification: "VENDOR_VERIFICATION",
  unusualAmount: "UNUSUAL_AMOUNT",
  dateAnomaly: "DATE_ANOMALY",
  gstin: "GSTIN",
  roundAmount: "ROUND_AMOUNT",
  splitInvoice: "SPLIT_INVOICE"
} as const;

export const DEFAULT_SEVERITY_SCORES: Record<Severity, number> = {
  LOW: 10,
  MEDIUM: 20,
  HIGH: 30,
  CRITICAL: 50
};
