import { ANOMALY_RULE_IDS } from "../anomaly.constants";
import { makeSignal, parseDate, signedDaysBetween } from "../anomaly.helpers";
import type { AnomalyContext, AnomalyRule, AnomalySignal } from "../anomaly.types";

export class DateAnomalyRule implements AnomalyRule {
  id = ANOMALY_RULE_IDS.dateAnomaly;
  name = "Date anomaly";
  enabled = true;

  async evaluate(context: AnomalyContext): Promise<AnomalySignal | null> {
    const invoiceDate = parseDate(context.invoice.invoiceDate);
    if (!invoiceDate) return null;

    const dueDate = parseDate(context.invoice.dueDate);
    if (dueDate && dueDate.getTime() < invoiceDate.getTime()) {
      return makeSignal(
        {
          ruleId: this.id,
          type: "DUE_DATE_BEFORE_INVOICE_DATE",
          severity: "MEDIUM",
          title: "Due date is before invoice date",
          message: "Invoice due date is earlier than the invoice date.",
          evidence: [{ field: "dueDate", actual: context.invoice.dueDate, expected: context.invoice.invoiceDate }]
        },
        context.ruleConfig.severityScores
      );
    }

    if (invoiceDate.getTime() > context.currentDate.getTime()) {
      return makeSignal(
        {
          ruleId: this.id,
          type: "FUTURE_INVOICE_DATE",
          severity: "MEDIUM",
          title: "Future invoice date",
          message: "Invoice date is later than the evaluation date.",
          evidence: [{ field: "invoiceDate", actual: context.invoice.invoiceDate, expected: context.currentDate.toISOString() }]
        },
        context.ruleConfig.severityScores
      );
    }

    const poDate = parseDate(context.purchaseOrder?.poDate ?? context.purchaseOrder?.createdAt);
    if (!poDate) {
      const ageDays = signedDaysBetween(invoiceDate, context.currentDate);
      if (ageDays > context.ruleConfig.oldInvoiceDays) {
        return makeSignal(
          {
            ruleId: this.id,
            type: "VERY_OLD_INVOICE",
            severity: "LOW",
            title: "Very old invoice",
            message: `Invoice date is ${Math.round(ageDays)} days before the evaluation date.`,
            evidence: [{ field: "invoiceDate", actual: context.invoice.invoiceDate, expected: context.currentDate.toISOString(), difference: Math.round(ageDays) }],
            metadata: { oldInvoiceDays: context.ruleConfig.oldInvoiceDays }
          },
          context.ruleConfig.severityScores
        );
      }
      return null;
    }

    const daysAfterPo = signedDaysBetween(poDate, invoiceDate);
    if (daysAfterPo < 0) {
      return makeSignal(
        {
          ruleId: this.id,
          type: "INVOICE_DATE_BEFORE_PO",
          severity: "MEDIUM",
          title: "Invoice date is before purchase order",
          message: "Invoice date is earlier than the purchase order date.",
          evidence: [
            {
              field: "invoiceDate",
              actual: context.invoice.invoiceDate,
              expected: context.purchaseOrder?.poDate ?? context.purchaseOrder?.createdAt,
              difference: Math.round(daysAfterPo)
            }
          ]
        },
        context.ruleConfig.severityScores
      );
    }

    if (daysAfterPo > context.ruleConfig.staleInvoiceDays) {
      return makeSignal(
        {
          ruleId: this.id,
          type: "STALE_INVOICE",
          severity: context.ruleConfig.staleInvoiceSeverity,
          title: "Invoice date is significantly after purchase order",
          message: `Invoice date is ${Math.round(daysAfterPo)} days after the purchase order date.`,
          evidence: [
            {
              field: "invoiceDate",
              actual: context.invoice.invoiceDate,
              expected: context.purchaseOrder?.poDate ?? context.purchaseOrder?.createdAt,
              difference: Math.round(daysAfterPo)
            }
          ],
          metadata: { staleInvoiceDays: context.ruleConfig.staleInvoiceDays }
        },
        context.ruleConfig.severityScores
      );
    }

    const ageDays = signedDaysBetween(invoiceDate, context.currentDate);
    if (ageDays > context.ruleConfig.oldInvoiceDays) {
      return makeSignal(
        {
          ruleId: this.id,
          type: "VERY_OLD_INVOICE",
          severity: "LOW",
          title: "Very old invoice",
          message: `Invoice date is ${Math.round(ageDays)} days before the evaluation date.`,
          evidence: [{ field: "invoiceDate", actual: context.invoice.invoiceDate, expected: context.currentDate.toISOString(), difference: Math.round(ageDays) }],
          metadata: { oldInvoiceDays: context.ruleConfig.oldInvoiceDays }
        },
        context.ruleConfig.severityScores
      );
    }

    return null;
  }
}
