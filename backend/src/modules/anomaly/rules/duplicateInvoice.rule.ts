import { ANOMALY_RULE_IDS } from "../anomaly.constants";
import {
  amountDifferencePercentage,
  areInvoiceNumbersSimilar,
  daysBetween,
  makeSignal,
  parseDate,
  sameVendor
} from "../anomaly.helpers";
import type { AnomalyContext, AnomalyRule, AnomalySignal } from "../anomaly.types";

export class DuplicateInvoiceRule implements AnomalyRule {
  id = ANOMALY_RULE_IDS.duplicateInvoice;
  name = "Duplicate invoice";
  enabled = true;

  async evaluate(context: AnomalyContext): Promise<AnomalySignal | null> {
    const { invoice, historicalInvoices, recentInvoices, ruleConfig } = context;
    const invoiceNumber = invoice.invoiceNumber?.trim();
    const history = [...historicalInvoices, ...recentInvoices];

    if (invoiceNumber) {
      const exact = history.find(
        (item) => sameVendor(invoice, item) && item.invoiceNumber?.trim() === invoiceNumber
      );
      if (exact) {
        return makeSignal(
          {
            ruleId: this.id,
            type: "DUPLICATE_INVOICE",
            severity: "HIGH",
            title: "Duplicate invoice detected",
            message: "An invoice with the same vendor and invoice number already exists.",
            evidence: [
              { field: "vendorId", actual: invoice.vendorId, expected: exact.vendorId },
              { field: "invoiceNumber", actual: invoiceNumber, expected: exact.invoiceNumber }
            ],
            metadata: { duplicateInvoiceId: exact.id, hardBlock: true }
          },
          ruleConfig.severityScores
        );
      }
    }

    const invoiceDate = parseDate(invoice.invoiceDate);
    const amount = invoice.totalAmount;
    if (!invoiceDate || amount === undefined || amount === null) return null;

    const potential = history.find((item) => {
      const itemDate = parseDate(item.invoiceDate);
      return (
        sameVendor(invoice, item) &&
        item.totalAmount === amount &&
        itemDate !== null &&
        daysBetween(invoiceDate, itemDate) <= ruleConfig.duplicateWindowDays
      );
    });

    if (potential) {
      return makeSignal(
        {
          ruleId: this.id,
          type: "POTENTIAL_DUPLICATE_INVOICE",
          severity: "HIGH",
          title: "Potential duplicate invoice detected",
          message: "Vendor and amount match a recent invoice within the configured duplicate window.",
          evidence: [
            { field: "vendorId", actual: invoice.vendorId, expected: potential.vendorId },
            { field: "totalAmount", actual: amount, expected: potential.totalAmount },
            { field: "invoiceDate", actual: invoice.invoiceDate, expected: potential.invoiceDate }
          ],
          metadata: { matchedInvoiceId: potential.id, duplicateWindowDays: ruleConfig.duplicateWindowDays }
        },
        ruleConfig.severityScores
      );
    }

    if (!invoiceNumber) return null;

    const similar = history.find((item) => {
      const candidateAmount = item.totalAmount;
      return (
        sameVendor(invoice, item) &&
        areInvoiceNumbersSimilar(invoiceNumber, item.invoiceNumber) &&
        candidateAmount !== undefined &&
        candidateAmount !== null &&
        amountDifferencePercentage(amount, candidateAmount) <= ruleConfig.similarInvoiceAmountTolerancePercentage
      );
    });

    if (!similar) return null;

    return makeSignal(
      {
        ruleId: this.id,
        type: "SIMILAR_INVOICE",
        severity: "MEDIUM",
        title: "Similar invoice detected",
        message: "Same vendor has a similar invoice number and same or near invoice amount.",
        evidence: [
          { field: "invoiceNumber", actual: invoiceNumber, expected: similar.invoiceNumber },
          {
            field: "totalAmount",
            actual: amount,
            expected: similar.totalAmount,
            differencePercentage: amountDifferencePercentage(amount, similar.totalAmount ?? amount)
          }
        ],
        metadata: {
          matchedInvoiceId: similar.id,
          amountTolerancePercentage: ruleConfig.similarInvoiceAmountTolerancePercentage
        }
      },
      ruleConfig.severityScores
    );
  }
}
