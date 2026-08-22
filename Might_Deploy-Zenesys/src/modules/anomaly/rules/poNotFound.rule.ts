import { ANOMALY_RULE_IDS } from "../anomaly.constants";
import { makeSignal } from "../anomaly.helpers";
import type { AnomalyContext, AnomalyRule, AnomalySignal } from "../anomaly.types";

export class PoNotFoundRule implements AnomalyRule {
  id = ANOMALY_RULE_IDS.poNotFound;
  name = "PO not found";
  enabled = true;

  async evaluate(context: AnomalyContext): Promise<AnomalySignal | null> {
    const { invoice, purchaseOrder, ruleConfig } = context;
    if (invoice.invoiceType !== "PO_BASED") return null;

    const reference = invoice.poId ?? invoice.poNumber;
    if (!reference) {
      return makeSignal(
        {
          ruleId: this.id,
          type: "MISSING_PO_REFERENCE",
          severity: ruleConfig.missingPoReferenceSeverity,
          title: "Missing purchase order reference",
          message: "PO-based invoice does not include a purchase order reference.",
          evidence: [{ field: "poId", actual: invoice.poId ?? null, expected: "Purchase order reference" }]
        },
        ruleConfig.severityScores
      );
    }

    if (!purchaseOrder) {
      return makeSignal(
        {
          ruleId: this.id,
          type: "PO_NOT_FOUND",
          severity: "HIGH",
          title: "Purchase order not found",
          message: "PO-based invoice references a purchase order that was not provided in context.",
          evidence: [{ field: "poReference", actual: reference, expected: "Existing purchase order" }]
        },
        ruleConfig.severityScores
      );
    }

    if (invoice.vendorId && purchaseOrder.vendorId && invoice.vendorId !== purchaseOrder.vendorId) {
      return makeSignal(
        {
          ruleId: this.id,
          type: "PO_VENDOR_MISMATCH",
          severity: "HIGH",
          title: "Purchase order vendor mismatch",
          message: "Invoice vendor differs from the purchase order vendor.",
          evidence: [{ field: "vendorId", actual: invoice.vendorId, expected: purchaseOrder.vendorId }]
        },
        ruleConfig.severityScores
      );
    }

    return null;
  }
}
