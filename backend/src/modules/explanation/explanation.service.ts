import type { AnomalySignal, AnomalyResult } from "../anomaly/anomaly.types";
import type { SignalExplanation, InvoiceExplanation } from "./explanation.types";

// ============================================================================
// SIGNAL EXPLANATION MAPPINGS (Deterministic, no LLM)
// ============================================================================

const SIGNAL_EXPLANATIONS: Record<string, Omit<SignalExplanation, "evidenceText">> = {
  DUPLICATE_INVOICE: {
    signalType: "DUPLICATE_INVOICE",
    severity: "CRITICAL",
    title: "Exact Duplicate Invoice",
    explanation:
      "This invoice is an exact duplicate of a previously processed invoice. Same invoice number, vendor, and amount.",
    recommendation: "Reject this invoice immediately. Contact vendor to clarify duplicate submission."
  },

  POTENTIAL_DUPLICATE_INVOICE: {
    signalType: "POTENTIAL_DUPLICATE_INVOICE",
    severity: "HIGH",
    title: "Potential Duplicate",
    explanation: "This invoice is very similar to a recent invoice from the same vendor with matching amount and date.",
    recommendation:
      "Review carefully against recent invoices. If confirmed duplicate, reject. Otherwise, require vendor documentation."
  },

  SIMILAR_INVOICE: {
    signalType: "SIMILAR_INVOICE",
    severity: "MEDIUM",
    title: "Similar Invoice Found",
    explanation: "A similar invoice exists in history. Amount and invoice date are very close to another recent invoice.",
    recommendation: "Cross-check against historical invoices to confirm legitimacy."
  },

  PO_NOT_FOUND: {
    signalType: "PO_NOT_FOUND",
    severity: "HIGH",
    title: "Purchase Order Not Found",
    explanation: "No matching purchase order exists for this invoice. Either PO does not exist, or vendor/amount mismatch.",
    recommendation:
      "Verify PO number with vendor. For non-PO invoices, confirm invoice type is set to NON_PO. May require Finance review."
  },

  MISSING_PO_REFERENCE: {
    signalType: "MISSING_PO_REFERENCE",
    severity: "MEDIUM",
    title: "Missing PO Reference",
    explanation: "Invoice is marked as PO_BASED but no PO number provided in invoice data.",
    recommendation: "Obtain PO number from vendor or reclassify as NON_PO invoice if applicable."
  },

  PO_VENDOR_MISMATCH: {
    signalType: "PO_VENDOR_MISMATCH",
    severity: "HIGH",
    title: "PO Vendor Mismatch",
    explanation: "The vendor on this invoice does not match the vendor on the referenced purchase order.",
    recommendation: "Verify vendor information immediately. This could indicate vendor substitution or data entry error."
  },

  AMOUNT_MISMATCH: {
    signalType: "AMOUNT_MISMATCH",
    severity: "MEDIUM",
    title: "Invoice Amount Does Not Match PO",
    explanation: "The invoice total amount differs significantly from the PO amount. Amount variance exceeds tolerance.",
    recommendation: "Request vendor explanation for the amount variance. Verify line items and pricing."
  },

  QUANTITY_MISMATCH: {
    signalType: "QUANTITY_MISMATCH",
    severity: "MEDIUM",
    title: "Quantity Mismatch",
    explanation:
      "The quantities invoiced do not match the purchase order quantities. May indicate partial delivery or overshipment.",
    recommendation: "Reconcile with receiving documentation. Confirm goods receipt matches invoice quantities."
  },

  VENDOR_NOT_IN_MASTER: {
    signalType: "VENDOR_NOT_IN_MASTER",
    severity: "HIGH",
    title: "Vendor Not in Master Record",
    explanation: "This vendor does not exist in the vendor master database.",
    recommendation: "Create vendor master record or verify vendor ID. New vendor onboarding may be required."
  },

  VENDOR_INACTIVE: {
    signalType: "VENDOR_INACTIVE",
    severity: "HIGH",
    title: "Vendor Inactive",
    explanation: "The vendor is marked as inactive in the vendor master. No invoices should be processed from inactive vendors.",
    recommendation: "Reactivate vendor if the relationship is current, or reject invoice from inactive vendor."
  },

  VENDOR_GSTIN_MISMATCH: {
    signalType: "VENDOR_GSTIN_MISMATCH",
    severity: "HIGH",
    title: "GSTIN Mismatch",
    explanation: "The GSTIN on the invoice does not match the GSTIN in the vendor master record.",
    recommendation: "Verify GSTIN with vendor. Update vendor master or request corrected invoice."
  },

  VENDOR_NOT_APPROVED: {
    signalType: "VENDOR_NOT_APPROVED",
    severity: "HIGH",
    title: "Vendor Not Approved",
    explanation: "This vendor is not approved for payment. May be pending approval or blacklisted.",
    recommendation: "Complete vendor approval process or escalate to procurement for clearance."
  },

  VENDOR_BANK_DETAILS_RECENTLY_CHANGED: {
    signalType: "VENDOR_BANK_DETAILS_RECENTLY_CHANGED",
    severity: "MEDIUM",
    title: "Vendor Bank Details Recently Changed",
    explanation: "The vendor's bank account information was updated recently. Exercise caution for potential fraud.",
    recommendation: "Verify bank change directly with vendor via established contact. Confirm payment goes to correct account."
  },

  UNUSUAL_AMOUNT: {
    signalType: "UNUSUAL_AMOUNT",
    severity: "MEDIUM",
    title: "Unusual Invoice Amount",
    explanation: "The invoice amount is significantly higher than historical average for this vendor.",
    recommendation: "Verify the amount is correct. Request vendor breakdown if amount seems excessive."
  },

  UNUSUAL_LOW_AMOUNT: {
    signalType: "UNUSUAL_LOW_AMOUNT",
    severity: "LOW",
    title: "Unusually Low Amount",
    explanation: "The invoice amount is unusually low compared to historical vendor invoices.",
    recommendation: "Verify line items are correct. Confirm partial shipment if amount is lower than typical."
  },

  AMOUNT_EXCEEDS_HISTORICAL_MAXIMUM: {
    signalType: "AMOUNT_EXCEEDS_HISTORICAL_MAXIMUM",
    severity: "MEDIUM",
    title: "Amount Exceeds Historical Maximum",
    explanation: "This invoice amount exceeds the maximum ever invoiced by this vendor.",
    recommendation: "Review the invoice carefully. Request detailed breakdown and ensure amount is justified."
  },

  UNUSUAL_INVOICE_FREQUENCY: {
    signalType: "UNUSUAL_INVOICE_FREQUENCY",
    severity: "LOW",
    title: "Unusual Invoice Frequency",
    explanation: "Multiple invoices from this vendor received in a short timeframe. Pattern differs from history.",
    recommendation: "Verify invoices represent separate transactions. Check for split invoicing."
  },

  FUTURE_INVOICE_DATE: {
    signalType: "FUTURE_INVOICE_DATE",
    severity: "HIGH",
    title: "Future Invoice Date",
    explanation: "The invoice date is in the future (after today).",
    recommendation: "Request corrected invoice with valid date. Future-dated invoices cannot be processed."
  },

  INVOICE_DATE_BEFORE_PO: {
    signalType: "INVOICE_DATE_BEFORE_PO",
    severity: "HIGH",
    title: "Invoice Dated Before PO",
    explanation: "The invoice date is earlier than the purchase order date. Impossible — invoice cannot predate PO.",
    recommendation: "Verify dates with vendor. Request corrected invoice."
  },

  STALE_INVOICE: {
    signalType: "STALE_INVOICE",
    severity: "MEDIUM",
    title: "Stale Invoice",
    explanation: "This invoice is unusually old (submitted long after invoice date). May indicate delayed processing.",
    recommendation: "Verify with vendor the reason for delay. Confirm goods/services were received."
  },

  VERY_OLD_INVOICE: {
    signalType: "VERY_OLD_INVOICE",
    severity: "MEDIUM",
    title: "Very Old Invoice",
    explanation: "This invoice is very old (invoice date is significantly in the past).",
    recommendation: "Verify this is not a duplicate submission. Confirm goods/services were legitimately delivered."
  },

  DUE_DATE_BEFORE_INVOICE_DATE: {
    signalType: "DUE_DATE_BEFORE_INVOICE_DATE",
    severity: "HIGH",
    title: "Invalid Due Date",
    explanation: "The payment due date is before the invoice date. Logically impossible.",
    recommendation: "Request corrected invoice from vendor with valid due date."
  },

  INVALID_GSTIN_FORMAT: {
    signalType: "INVALID_GSTIN_FORMAT",
    severity: "MEDIUM",
    title: "Invalid GSTIN Format",
    explanation: "The GSTIN format is invalid. Does not match standard 15-character format.",
    recommendation: "Request vendor provide valid GSTIN or correct the invoice."
  },

  GSTIN_MISMATCH: {
    signalType: "GSTIN_MISMATCH",
    severity: "MEDIUM",
    title: "GSTIN Format Error",
    explanation: "GSTIN validation failed. Format or checksum is invalid.",
    recommendation: "Request vendor verify and provide correct GSTIN."
  },

  TAX_ARITHMETIC_MISMATCH: {
    signalType: "TAX_ARITHMETIC_MISMATCH",
    severity: "MEDIUM",
    title: "Tax Calculation Error",
    explanation: "Tax amount does not match calculated amount based on subtotal and tax rate.",
    recommendation: "Verify tax calculation with vendor. Request corrected invoice if necessary."
  },

  MISSING_TAX_INFORMATION: {
    signalType: "MISSING_TAX_INFORMATION",
    severity: "MEDIUM",
    title: "Missing Tax Information",
    explanation: "Tax information is missing from the invoice. Cannot validate tax amounts.",
    recommendation: "Request vendor provide complete tax details on corrected invoice."
  },

  ROUND_AMOUNT: {
    signalType: "ROUND_AMOUNT",
    severity: "LOW",
    title: "Round Amount",
    explanation: "The invoice amount is a suspiciously round number (e.g., ₹1,00,000 exactly).",
    recommendation: "Not necessarily an issue, but verify amount with vendor to ensure accuracy."
  },

  NEAR_APPROVAL_THRESHOLD: {
    signalType: "NEAR_APPROVAL_THRESHOLD",
    severity: "LOW",
    title: "Near Approval Threshold",
    explanation: "Invoice amount is just below an approval threshold. Could indicate intentional split.",
    recommendation: "Verify with vendor that amounts represent legitimate separate invoices."
  },

  POTENTIAL_SPLIT_INVOICING: {
    signalType: "POTENTIAL_SPLIT_INVOICING",
    severity: "HIGH",
    title: "Potential Split Invoicing",
    explanation:
      "Multiple invoices from same vendor for same PO detected. Combined amount matches or exceeds PO. Possible fraudulent invoice splitting.",
    recommendation:
      "Combine and review all related invoices together. Verify each line item against PO. Reject if splitting appears intentional."
  },

  CORRELATED_HIGH_REVIEW_PRIORITY: {
    signalType: "CORRELATED_HIGH_REVIEW_PRIORITY",
    severity: "HIGH",
    title: "Multiple Risk Indicators",
    explanation:
      "Multiple independent risk factors detected together. Correlation between different risk dimensions increases concern.",
    recommendation: "This invoice requires Finance Manager review. Multiple factors suggest elevated risk."
  },

  RULE_EVALUATION_FAILED: {
    signalType: "RULE_EVALUATION_FAILED",
    severity: "MEDIUM",
    title: "Rule Evaluation Error",
    explanation: "One or more anomaly rules failed during evaluation. Some validations could not be completed.",
    recommendation: "Review system logs for errors. May need to retry evaluation or investigate data quality issues."
  }
};

// ============================================================================
// EXPLANATION SERVICE
// ============================================================================

class ExplanationService {
  /**
   * Generate human-readable explanation for a single signal.
   */
  generateSignalExplanation(signal: AnomalySignal): SignalExplanation {
    const base = SIGNAL_EXPLANATIONS[signal.type] || {
      signalType: signal.type,
      severity: signal.severity,
      title: signal.title,
      explanation: signal.message,
      recommendation: "Review manually or contact Finance team for guidance."
    };

    // Build evidence text from signal evidence array
    let evidenceText: string | undefined;
    if (signal.evidence && signal.evidence.length > 0) {
      const evidenceSummary = signal.evidence
        .map((e) => {
          if (e.actual !== undefined && e.expected !== undefined) {
            return `${e.field}: expected ${e.expected}, got ${e.actual}`;
          } else if (e.actual !== undefined) {
            return `${e.field}: ${e.actual}`;
          }
          return e.field;
        })
        .join("; ");

      evidenceText = `Evidence: ${evidenceSummary}`;
    }

    return {
      ...base,
      evidenceText
    };
  }

  /**
   * Generate complete explanation for invoice's anomaly result.
   */
  generateInvoiceExplanation(invoiceId: string, anomalyResult: any): any {
    const signals = anomalyResult.signals || [];
    const signalExplanations = signals.map((signal: AnomalySignal) =>
      this.generateSignalExplanation(signal)
    );

    const riskLevel = anomalyResult.risk.level;
    const decision = anomalyResult.decision.status;

    // Generate summary based on risk level
    let summary: string;
    if (decision === "BLOCKED") {
      summary = `This invoice has been BLOCKED due to critical deterministic exceptions: ${anomalyResult.decision.reason}`;
    } else if (decision === "REVIEW_REQUIRED") {
      summary = `This invoice requires Finance Manager review. ${riskLevel}-level financial exceptions detected: ${anomalyResult.decision.reason}`;
    } else {
      summary = `This invoice is eligible for automatic processing. No review-level exceptions detected.`;
    }

    // Generate next steps based on decision
    let nextSteps: string[] = [];
    if (decision === "BLOCKED") {
      nextSteps = [
        "Contact vendor to clarify or correct the invoice",
        "Update vendor master information if necessary",
        "Resubmit corrected invoice for processing"
      ];
    } else if (decision === "REVIEW_REQUIRED") {
      nextSteps = [
        "Finance Manager reviews invoice and risk signals",
        "Request additional documentation if needed",
        "Approve for payment or reject with reason",
        "If rejected, contact vendor for correction"
      ];
    } else {
      nextSteps = [
        "Process for payment",
        "Route to payment processing system",
        "Payment scheduled per normal terms"
      ];
    }

    return {
      invoiceId,
      overallRiskLevel: riskLevel,
      overallDecision: decision,
      summary,
      signals: signalExplanations,
      nextSteps,
      createdAt: new Date()
    };
  }
}

export const explanationService = new ExplanationService();
