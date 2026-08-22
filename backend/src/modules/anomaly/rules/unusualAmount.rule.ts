import { ANOMALY_RULE_IDS } from "../anomaly.constants";
import { makeSignal, percent } from "../anomaly.helpers";
import type { AnomalyContext, AnomalyRule, AnomalySignal } from "../anomaly.types";

export class UnusualAmountRule implements AnomalyRule {
  id = ANOMALY_RULE_IDS.unusualAmount;
  name = "Unusual historical amount";
  enabled = true;

  async evaluate(context: AnomalyContext): Promise<AnomalySignal | null> {
    const amounts = context.historicalInvoices
      .map((invoice) => invoice.totalAmount)
      .filter((amount): amount is number => amount !== undefined && amount !== null && amount > 0);
    const currentAmount = context.invoice.totalAmount;
    if (
      currentAmount === undefined ||
      currentAmount === null ||
      currentAmount <= 0 ||
      amounts.length < context.ruleConfig.historicalMinimumInvoices
    ) {
      return null;
    }

    const historicalAverage = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
    if (historicalAverage <= 0) return null;

    const multiple = currentAmount / historicalAverage;
    const historicalMaximum = Math.max(...amounts);
    const historicalMinimum = Math.min(...amounts);
    if (currentAmount > historicalMaximum && multiple <= context.ruleConfig.unusualAmountMultiplier) {
      return makeSignal(
        {
          ruleId: this.id,
          type: "AMOUNT_EXCEEDS_HISTORICAL_MAXIMUM",
          severity: multiple > context.ruleConfig.unusualAmountMultiplier ? "MEDIUM" : "LOW",
          title: "Invoice amount exceeds historical maximum",
          message: "Current invoice amount is higher than the vendor historical maximum.",
          evidence: [
            { field: "historicalMaximum", actual: historicalMaximum },
            { field: "currentAmount", actual: currentAmount, expected: historicalMaximum },
            { field: "multiple", actual: percent(multiple), expected: context.ruleConfig.unusualAmountMultiplier },
            { field: "historicalInvoiceCount", actual: amounts.length }
          ]
        },
        context.ruleConfig.severityScores
      );
    }

    if (currentAmount < historicalMinimum * 0.5) {
      return makeSignal(
        {
          ruleId: this.id,
          type: "UNUSUAL_LOW_AMOUNT",
          severity: "LOW",
          title: "Invoice amount is unusually low",
          message: "Current invoice amount is significantly below the vendor historical range.",
          evidence: [
            { field: "historicalMinimum", actual: historicalMinimum },
            { field: "currentAmount", actual: currentAmount, expected: historicalMinimum },
            { field: "historicalInvoiceCount", actual: amounts.length }
          ]
        },
        context.ruleConfig.severityScores
      );
    }

    if (multiple <= context.ruleConfig.unusualAmountMultiplier) return null;

    return makeSignal(
      {
        ruleId: this.id,
        type: "UNUSUAL_AMOUNT",
        severity: "MEDIUM",
        title: "Invoice amount is unusual for this vendor",
        message: `Current invoice is ${percent(multiple)}x the vendor historical average.`,
        evidence: [
          { field: "historicalAverage", actual: historicalAverage },
          { field: "currentAmount", actual: currentAmount, expected: historicalAverage },
          { field: "multiple", actual: percent(multiple), expected: context.ruleConfig.unusualAmountMultiplier },
          { field: "historicalInvoiceCount", actual: amounts.length }
        ]
      },
      context.ruleConfig.severityScores
    );
  }
}
