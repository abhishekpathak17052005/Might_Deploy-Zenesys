// ============================================================================
// CONTEXT ADAPTER
// ============================================================================
// Converts RiskContext (from context module) to AnomalyContext (for anomaly engine).
// This is the hookpoint that connects verification layer to anomaly evaluation.

import type { RiskContext } from "./context.types";
import type { AnomalyContext } from "../anomaly/anomaly.types";
import { mergeAnomalyConfig } from "../anomaly/anomaly.config";

/**
 * Adapt RiskContext to AnomalyContext format for anomaly engine evaluation.
 * Maps verified data from context layer into the input format anomaly rules expect.
 */
export function adaptRiskContextToAnomalyContext(riskContext: RiskContext): Omit<AnomalyContext, "ruleConfig" | "currentDate"> {
  return {
    invoice: {
      id: riskContext.invoice.id,
      invoiceNumber: riskContext.invoice.invoiceNumber,
      invoiceType: riskContext.invoice.invoiceType,
      vendorId: riskContext.invoice.vendorId,
      vendorName: riskContext.invoice.vendorName,
      poId: riskContext.invoice.poId,
      poNumber: riskContext.invoice.poNumber,
      totalAmount: riskContext.invoice.totalAmount,
      subtotal: riskContext.invoice.subtotal,
      taxAmount: riskContext.invoice.taxAmount,
      invoiceDate: riskContext.invoice.invoiceDate,
      dueDate: riskContext.invoice.dueDate,
      gstin: riskContext.invoice.vendorId, // Will be filled from vendor context
      lineItems: riskContext.invoice.lineItems?.map(item => ({
        id: item.id,
        sku: item.sku,
        description: item.description,
        quantity: item.quantity,
        amount: item.total
      }))
    },

    vendor: riskContext.vendor ? {
      id: riskContext.vendor.vendorId,
      name: riskContext.vendor.vendorName,
      gstin: riskContext.vendor.gstin,
      isActive: riskContext.vendor.vendorActive,
      isApproved: riskContext.vendor.vendorTaxRegistered,
      legalName: riskContext.vendor.vendorName
    } : undefined,

    purchaseOrder: riskContext.po ? {
      id: riskContext.po.poId,
      poNumber: riskContext.po.poNumber,
      vendorId: riskContext.invoice.vendorId,
      totalAmount: riskContext.po.poAmount,
      poDate: riskContext.po.poDate,
      lineItems: [] // PO line items not tracked in RiskContext yet
    } : undefined,

    historicalInvoices: riskContext.history ? [
      {
        id: `historical_${riskContext.history.vendorId}`,
        vendorId: riskContext.history.vendorId,
        invoiceNumber: undefined,
        totalAmount: riskContext.history.averageAmount,
        invoiceDate: riskContext.history.lastInvoiceDate,
        lineItems: riskContext.history.averageQuantity ? [
          { quantity: riskContext.history.averageQuantity }
        ] : []
      }
    ] : [],

    recentInvoices: [] // Populated by context service in Phase 3
  };
}

/**
 * Create complete AnomalyContext from RiskContext with default config and current date.
 */
export function createAnomalyContextFromRiskContext(riskContext: RiskContext, config?: any, currentDate?: Date): AnomalyContext {
  const baseContext = adaptRiskContextToAnomalyContext(riskContext);
  
  return {
    ...baseContext,
    ruleConfig: mergeAnomalyConfig(config),
    currentDate: currentDate ?? new Date()
  };
}
