import type { InvoiceDocument, VerificationResult } from "../invoices/invoice.types";
import type { RiskContext, VendorContext, POContext, HistoricalContext } from "./context.types";
import { createAnomalyContextFromRiskContext } from "./context.adapter";
import { anomalyEngine } from "../anomaly/anomaly.engine.instance";
import type { AnomalyResult } from "../anomaly/anomaly.types";

// ============================================================================
// CONTEXT SERVICE
// ============================================================================
// Builds the complete RiskContext that the anomaly engine consumes.
// Does NOT perform anomaly detection — only verification and data gathering.

class ContextService {
  /**
   * Build complete risk context for an invoice.
   * Gathers verification results and contextual data needed by anomaly engine.
   */
  async buildRiskContext(invoice: InvoiceDocument): Promise<RiskContext> {
    const errors: Array<{ step: string; message: string }> = [];

    // Step 1: Verify GST (basic format check)
    let verificationResult: VerificationResult = {};
    try {
      verificationResult = await this.verifyGST(invoice);
    } catch (error) {
      errors.push({
        step: "GST_VERIFICATION",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }

    // Step 2: Gather vendor context
    let vendor: VendorContext | undefined;
    if (invoice.vendorId) {
      try {
        vendor = await this.gatherVendorContext(invoice.vendorId, invoice.vendorName || undefined);
      } catch (error) {
        errors.push({
          step: "VENDOR_CONTEXT",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    // Step 3: Gather PO context
    let po: POContext | undefined;
    if (invoice.poId) {
      try {
        po = await this.gatherPOContext(invoice.poId, invoice.vendorId || undefined);
      } catch (error) {
        errors.push({
          step: "PO_CONTEXT",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    // Step 4: Gather historical context
    let history: HistoricalContext | undefined;
    if (invoice.vendorId) {
      try {
        history = await this.gatherHistoricalContext(invoice.vendorId);
      } catch (error) {
        errors.push({
          step: "HISTORICAL_CONTEXT",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    // Build complete risk context
    const riskContext: RiskContext = {
      invoice,
      verification: verificationResult,
      vendor,
      po,
      history,
      contextBuiltAt: new Date(),
      contextVersion: "1.0"
    };

    return riskContext;
  }

  /**
   * Verify GST format and match with vendor.
   * Basic validation only — not authoritative GST lookup.
   */
  private async verifyGST(invoice: InvoiceDocument): Promise<VerificationResult> {
    const result: VerificationResult = {};

    // TODO: Implement GSTIN format validation
    // TODO: Implement vendor GSTIN matching (requires vendor service)

    return result;
  }

  /**
   * Gather vendor context: existence, GSTIN, active status, risk profile.
   */
  private async gatherVendorContext(
    vendorId: string,
    vendorName?: string
  ): Promise<VendorContext> {
    // TODO: Query vendor service for:
    // - Vendor existence
    // - GSTIN validation
    // - Active status
    // - Historical invoice count
    // - Historical anomaly rate
    // - Risk profile

    // For now, return placeholder
    return {
      vendorId,
      vendorName,
      vendorExists: true,
      vendorActive: true
    };
  }

  /**
   * Gather PO context: existence, vendor match, amounts, dates.
   */
  private async gatherPOContext(poId: string, vendorId?: string): Promise<POContext> {
    // TODO: Query PO service for:
    // - PO existence
    // - Vendor match validation
    // - PO amount and quantity
    // - PO date and due date
    // - PO status

    // For now, return placeholder
    return {
      poId,
      poExists: true,
      poVendorMatch: true
    };
  }

  /**
   * Gather historical context: previous invoices, anomalies, patterns.
   */
  private async gatherHistoricalContext(vendorId: string): Promise<HistoricalContext> {
    // TODO: Query invoice history for:
    // - Invoice count (last 7/30/90 days)
    // - Anomaly count and rate
    // - Average amount and quantity
    // - Last invoice date
    // - Duplicate detection window

    // For now, return placeholder
    return {
      vendorId,
      invoiceCount: 0
    };
  }

  /**
   * Verify PO quantity aggregation.
   * Returns combined quantity across invoices for the same PO.
   */
  async verifyPOQuantityAggregation(
    vendorId: string,
    poId: string,
    currentInvoiceId: string
  ): Promise<number> {
    // TODO: Query related invoices and sum their quantities
    // Exclude current invoice to avoid double-counting
    return 0;
  }

  /**
   * Verify PO amount aggregation.
   * Returns combined amount across invoices for the same PO.
   */
  async verifyPOAmountAggregation(
    vendorId: string,
    poId: string,
    currentInvoiceId: string
  ): Promise<number> {
    // TODO: Query related invoices and sum their amounts
    // Exclude current invoice to avoid double-counting
    return 0;
  }

  /**
   * Evaluate invoice risk using the anomaly engine.
   * This is the hookpoint: RiskContext → AnomalyEngine → AnomalyResult
   */
  async evaluateRisk(riskContext: RiskContext): Promise<AnomalyResult> {
    const anomalyContext = createAnomalyContextFromRiskContext(riskContext);
    const result = await anomalyEngine.evaluate(anomalyContext);
    return result;
  }
}

export const contextService = new ContextService();
