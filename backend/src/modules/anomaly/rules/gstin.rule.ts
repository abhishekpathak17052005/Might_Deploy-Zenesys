import { ANOMALY_RULE_IDS } from "../anomaly.constants";
import { isValidIndianGstin, makeSignal, normalizeGstin } from "../anomaly.helpers";
import type { AnomalyContext, AnomalyRule, AnomalySignal } from "../anomaly.types";

export class GstinRule implements AnomalyRule {
  id = ANOMALY_RULE_IDS.gstin;
  name = "GSTIN validation";
  enabled = true;

  async evaluate(context: AnomalyContext): Promise<AnomalySignal | null> {
    const invoiceGstin = normalizeGstin(context.invoice.gstin);
    const vendorGstin = normalizeGstin(context.vendor?.gstin);

    if (invoiceGstin && !isValidIndianGstin(invoiceGstin)) {
      return makeSignal(
        {
          ruleId: this.id,
          type: "INVALID_GSTIN_FORMAT",
          severity: "LOW",
          title: "Invalid GSTIN format",
          message: "Invoice GSTIN does not match the expected Indian GSTIN structure.",
          evidence: [{ field: "gstin", actual: invoiceGstin, expected: "15-character Indian GSTIN pattern" }],
          metadata: { validation: "FORMAT_INVALID" }
        },
        context.ruleConfig.severityScores
      );
    }

    if (invoiceGstin && vendorGstin && invoiceGstin !== vendorGstin) {
      return makeSignal(
        {
          ruleId: this.id,
          type: "GSTIN_MISMATCH",
          severity: "HIGH",
          title: "GSTIN mismatch",
          message: "Invoice GSTIN differs from the vendor master GSTIN.",
          evidence: [{ field: "gstin", actual: invoiceGstin, expected: vendorGstin }],
          metadata: { validation: "GSTIN_MISMATCH" }
        },
        context.ruleConfig.severityScores
      );
    }

    const { subtotal, taxAmount, discountAmount, totalAmount } = context.invoice;
    if (context.ruleConfig.taxRequired && (taxAmount === undefined || taxAmount === null)) {
      return makeSignal(
        {
          ruleId: this.id,
          type: "MISSING_TAX_INFORMATION",
          severity: "LOW",
          title: "Missing tax information",
          message: "Tax information is required by configuration but missing from the invoice.",
          evidence: [{ field: "taxAmount", actual: taxAmount ?? null, expected: "Configured tax amount" }]
        },
        context.ruleConfig.severityScores
      );
    }

    if (
      subtotal !== undefined &&
      subtotal !== null &&
      taxAmount !== undefined &&
      taxAmount !== null &&
      totalAmount !== undefined &&
      totalAmount !== null
    ) {
      const expectedTotal = subtotal + taxAmount - (discountAmount ?? 0);
      const difference = totalAmount - expectedTotal;
      if (Math.abs(difference) > context.ruleConfig.taxArithmeticTolerance) {
        return makeSignal(
          {
            ruleId: this.id,
            type: "TAX_ARITHMETIC_MISMATCH",
            severity: "MEDIUM",
            title: "Tax arithmetic mismatch",
            message: "Invoice subtotal, tax, discount, and total do not reconcile within the configured tolerance.",
            evidence: [{ field: "totalAmount", actual: totalAmount, expected: expectedTotal, difference }]
          },
          context.ruleConfig.severityScores
        );
      }
    }

    return null;
  }
}
