import { ANOMALY_RULE_IDS } from "../anomaly.constants";
import { amountDifferencePercentage, makeSignal } from "../anomaly.helpers";
import type { AnomalyContext, AnomalyRule, AnomalySignal, Severity } from "../anomaly.types";

export class AmountMismatchRule implements AnomalyRule {
  id = ANOMALY_RULE_IDS.amountMismatch;
  name = "Amount mismatch";
  enabled = true;

  async evaluate(context: AnomalyContext): Promise<AnomalySignal | null> {
    const { invoice, purchaseOrder, ruleConfig } = context;
    const invoiceTotal = invoice.totalAmount;
    const poTotal = purchaseOrder?.totalAmount;
    if (invoiceTotal === undefined || invoiceTotal === null || poTotal === undefined || poTotal === null || poTotal === 0) {
      return null;
    }

    const difference = invoiceTotal - poTotal;
    if (difference <= 0) return null;

    const differencePercentage = amountDifferencePercentage(invoiceTotal, poTotal);
    if (differencePercentage <= ruleConfig.amountMismatchTolerancePercentage) return null;

    const thresholds = ruleConfig.amountMismatchSeverityThresholds;
    let severity: Severity = "MEDIUM";
    if (differencePercentage >= thresholds.critical) severity = "CRITICAL";
    else if (differencePercentage >= thresholds.high) severity = "HIGH";
    else if (differencePercentage >= thresholds.medium) severity = "MEDIUM";

    return makeSignal(
      {
        ruleId: this.id,
        type: "AMOUNT_MISMATCH",
        severity,
        title: "Invoice amount exceeds purchase order",
        message: `Invoice total exceeds the purchase order by ${differencePercentage}%.`,
        evidence: [
          {
            field: "totalAmount",
            actual: invoiceTotal,
            expected: poTotal,
            difference,
            differencePercentage
          }
        ]
      },
      ruleConfig.severityScores
    );
  }
}
