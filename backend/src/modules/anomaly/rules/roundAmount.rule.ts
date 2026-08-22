import { ANOMALY_RULE_IDS } from "../anomaly.constants";
import { makeSignal } from "../anomaly.helpers";
import type { AnomalyContext, AnomalyRule, AnomalySignal } from "../anomaly.types";

export class RoundAmountRule implements AnomalyRule {
  id = ANOMALY_RULE_IDS.roundAmount;
  name = "Round amount heuristic";
  enabled = true;

  async evaluate(context: AnomalyContext): Promise<AnomalySignal | null> {
    const config = context.ruleConfig.roundAmount;
    const amount = context.invoice.totalAmount;
    if (!config.enabled || amount === undefined || amount === null) return null;

    const threshold = context.ruleConfig.approvalThreshold;
    const lowerBound = threshold * (1 - context.ruleConfig.nearApprovalThresholdPercentage / 100);
    if (amount < threshold && amount >= lowerBound) {
      return makeSignal(
        {
          ruleId: this.id,
          type: "NEAR_APPROVAL_THRESHOLD",
          severity: "LOW",
          title: "Invoice amount is near approval threshold",
          message: "Invoice amount is just below the configured approval threshold.",
          evidence: [
            {
              field: "totalAmount",
              actual: amount,
              expected: threshold,
              difference: threshold - amount
            }
          ],
          metadata: { weakSignal: true, approvalThreshold: threshold }
        },
        context.ruleConfig.severityScores
      );
    }

    if (amount < config.minimumAmount) return null;
    if (!Number.isInteger(amount) || amount % 10000 !== 0) return null;

    return makeSignal(
      {
        ruleId: this.id,
        type: "ROUND_AMOUNT",
        severity: config.severity,
        title: "Round invoice amount",
        message: "Invoice amount is an unusually round number above the configured threshold.",
        evidence: [{ field: "totalAmount", actual: amount, expected: `Multiple of 10000 above ${config.minimumAmount}` }],
        metadata: { weakSignal: true, shouldNotBlockAlone: true }
      },
      context.ruleConfig.severityScores
    );
  }
}
