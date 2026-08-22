import { ANOMALY_RULE_IDS } from "../anomaly.constants";
import { getItemMatchKey, makeSignal, sameVendor } from "../anomaly.helpers";
import type { AnomalyContext, AnomalyRule, AnomalySignal, LineItemContext } from "../anomaly.types";

export class QuantityMismatchRule implements AnomalyRule {
  id = ANOMALY_RULE_IDS.quantityMismatch;
  name = "Quantity mismatch";
  enabled = true;

  async evaluate(context: AnomalyContext): Promise<AnomalySignal | null> {
    const invoiceItems = context.invoice.lineItems ?? [];
    const poItems = context.purchaseOrder?.lineItems ?? [];
    if (invoiceItems.length === 0 || poItems.length === 0) return null;

    // First, check single-invoice mismatch
    const singleInvoiceSignal = this.evaluateSingleInvoice(invoiceItems, poItems, context);
    if (singleInvoiceSignal) return singleInvoiceSignal;

    // Then, check aggregated mismatch across related invoices
    const aggregatedSignal = this.evaluateAggregatedQuantity(context);
    if (aggregatedSignal) return aggregatedSignal;

    return null;
  }

  private evaluateSingleInvoice(
    invoiceItems: LineItemContext[],
    poItems: LineItemContext[],
    context: AnomalyContext
  ): AnomalySignal | null {
    const poByKey = new Map<string, LineItemContext>();
    for (const item of poItems) {
      const key = getItemMatchKey(item);
      if (!key || poByKey.has(key)) continue;
      poByKey.set(key, item);
    }

    const evidence = [];
    for (const item of invoiceItems) {
      const key = getItemMatchKey(item);
      if (!key) continue;
      const poItem = poByKey.get(key);
      if (!poItem) continue;
      const invoiceQuantity = item.quantity;
      const poQuantity = poItem.quantity;
      if (
        invoiceQuantity !== undefined &&
        invoiceQuantity !== null &&
        poQuantity !== undefined &&
        poQuantity !== null &&
        invoiceQuantity > poQuantity
      ) {
        evidence.push({
          field: key,
          actual: invoiceQuantity,
          expected: poQuantity,
          difference: invoiceQuantity - poQuantity
        });
      }
    }

    if (evidence.length === 0) return null;

    return makeSignal(
      {
        ruleId: this.id,
        type: "QUANTITY_MISMATCH",
        severity: "MEDIUM",
        title: "Invoice quantity exceeds purchase order",
        message: "One or more matched invoice line items exceed purchase order quantities.",
        evidence,
        metadata: { aggregated: false }
      },
      context.ruleConfig.severityScores
    );
  }

  private evaluateAggregatedQuantity(context: AnomalyContext): AnomalySignal | null {
    // Find related invoices: same vendor, same PO
    const relatedInvoices = this.findRelatedInvoices(context);
    if (relatedInvoices.length === 0) return null;

    const poItems = context.purchaseOrder?.lineItems ?? [];
    if (poItems.length === 0) return null;

    // Build map of PO quantities by key
    const poByKey = new Map<string, number>();
    for (const item of poItems) {
      const key = getItemMatchKey(item);
      if (!key) continue;
      const quantity = item.quantity;
      if (quantity !== undefined && quantity !== null && quantity > 0) {
        poByKey.set(key, quantity);
      }
    }

    if (poByKey.size === 0) return null;

    // Aggregate quantities from all related invoices (including current)
    const aggregatedByKey = new Map<string, { total: number; count: number; invoices: string[] }>();

    // Add current invoice quantities
    const currentItems = context.invoice.lineItems ?? [];
    for (const item of currentItems) {
      const key = getItemMatchKey(item);
      if (!key) continue;
      const quantity = item.quantity;
      if (quantity !== undefined && quantity !== null && quantity > 0) {
        const current = aggregatedByKey.get(key) ?? { total: 0, count: 0, invoices: [] };
        current.total += quantity;
        current.count += 1;
        if (context.invoice.id) current.invoices.push(context.invoice.id);
        aggregatedByKey.set(key, current);
      }
    }

    // Add related invoice quantities
    for (const relatedInvoice of relatedInvoices) {
      if (!relatedInvoice.lineItems) continue;
      for (const item of relatedInvoice.lineItems) {
        const key = getItemMatchKey(item);
        if (!key) continue;
        const quantity = item.quantity;
        if (quantity !== undefined && quantity !== null && quantity > 0) {
          const current = aggregatedByKey.get(key) ?? { total: 0, count: 0, invoices: [] };
          current.total += quantity;
          current.count += 1;
          if (relatedInvoice.id) current.invoices.push(relatedInvoice.id);
          aggregatedByKey.set(key, current);
        }
      }
    }

    // Check if aggregated quantities exceed PO quantities
    const evidence = [];
    for (const [key, aggregated] of aggregatedByKey.entries()) {
      const poQuantity = poByKey.get(key);
      if (poQuantity !== undefined && aggregated.total > poQuantity) {
        evidence.push({
          field: key,
          actual: aggregated.total,
          expected: poQuantity,
          difference: aggregated.total - poQuantity,
          metadata: {
            aggregatedFrom: aggregated.count,
            invoices: aggregated.invoices
          }
        });
      }
    }

    if (evidence.length === 0) return null;

    return makeSignal(
      {
        ruleId: this.id,
        type: "QUANTITY_MISMATCH",
        severity: "HIGH",
        title: "Aggregated invoice quantity exceeds purchase order",
        message: `Combined quantities across ${relatedInvoices.length + 1} invoices exceed purchase order quantities.`,
        evidence,
        metadata: {
          aggregated: true,
          relatedInvoiceCount: relatedInvoices.length,
          totalInvoiceCount: relatedInvoices.length + 1
        }
      },
      context.ruleConfig.severityScores
    );
  }

  private findRelatedInvoices(context: AnomalyContext): (AnomalyContext["historicalInvoices"][0] & { lineItems?: LineItemContext[] })[] {
    const poId = context.invoice.poId ?? context.invoice.poNumber;
    if (!poId) return [];

    const allInvoices = [...(context.historicalInvoices ?? []), ...(context.recentInvoices ?? [])];
    const related = allInvoices.filter((inv) => {
      // Same vendor
      if (!sameVendor(context.invoice, inv)) return false;

      // Same PO
      const invPoId = inv.poId ?? inv.poNumber;
      if (invPoId !== poId) return false;

      // Exclude current invoice (avoid double-counting)
      if (inv.id && context.invoice.id && inv.id === context.invoice.id) return false;

      return true;
    });

    return related;
  }
}

