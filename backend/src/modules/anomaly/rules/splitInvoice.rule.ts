import { ANOMALY_RULE_IDS } from "../anomaly.constants";
import { daysBetween, makeSignal, parseDate, sameVendor } from "../anomaly.helpers";
import type { AnomalyContext, AnomalyRule, AnomalySignal } from "../anomaly.types";

export class SplitInvoiceRule implements AnomalyRule {
  id = ANOMALY_RULE_IDS.splitInvoice;
  name = "Split invoice";
  enabled = true;

  async evaluate(context: AnomalyContext): Promise<AnomalySignal | null> {
    const { invoice, purchaseOrder, ruleConfig } = context;
    const invoiceAmount = invoice.totalAmount;
    const poAmount = purchaseOrder?.totalAmount;
    const invoiceDate = parseDate(invoice.invoiceDate);
    const poReference = invoice.poId ?? invoice.poNumber;

    if (
      invoiceAmount === undefined ||
      invoiceAmount === null ||
      invoiceAmount >= ruleConfig.approvalThreshold ||
      poAmount === undefined ||
      poAmount === null ||
      poAmount <= 0 ||
      !invoiceDate ||
      !poReference
    ) {
      return null;
    }

    const related = context.historicalInvoices.filter((candidate) => {
      const candidateDate = parseDate(candidate.invoiceDate);
      const candidateAmount = candidate.totalAmount;
      const samePo =
        (invoice.poId && candidate.poId === invoice.poId) ||
        (invoice.poNumber && candidate.poNumber === invoice.poNumber);
      return (
        sameVendor(invoice, candidate) &&
        samePo &&
        candidateDate !== null &&
        candidateAmount !== undefined &&
        candidateAmount !== null &&
        candidateAmount < ruleConfig.approvalThreshold &&
        daysBetween(invoiceDate, candidateDate) <= ruleConfig.splitInvoiceWindowDays
      );
    });

    if (related.length === 0) return null;

    const combinedAmount = invoiceAmount + related.reduce((sum, item) => sum + (item.totalAmount ?? 0), 0);
    const requiredCoverageAmount = poAmount * (ruleConfig.splitInvoicePoCoveragePercentage / 100);
    if (combinedAmount < requiredCoverageAmount) return null;

    return makeSignal(
      {
        ruleId: this.id,
        type: "POTENTIAL_SPLIT_INVOICING",
        severity: "HIGH",
        title: "Potential invoice splitting pattern detected",
        message: "Multiple same-vendor PO invoices below the approval threshold collectively cover most of the purchase order.",
        evidence: [
          { field: "currentInvoiceAmount", actual: invoiceAmount, expected: `< ${ruleConfig.approvalThreshold}` },
          {
            field: "combinedAmount",
            actual: combinedAmount,
            expected: requiredCoverageAmount,
            difference: combinedAmount - requiredCoverageAmount
          },
          { field: "poAmount", actual: poAmount },
          { field: "relatedInvoices", actual: related.map((item) => ({ id: item.id, amount: item.totalAmount })) }
        ],
        metadata: {
          relatedInvoiceIds: related.map((item) => item.id).filter(Boolean),
          approvalThreshold: ruleConfig.approvalThreshold,
          poCoveragePercentage: ruleConfig.splitInvoicePoCoveragePercentage
        }
      },
      ruleConfig.severityScores
    );
  }
}
