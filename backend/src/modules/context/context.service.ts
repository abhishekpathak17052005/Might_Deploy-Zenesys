import mongoose from "mongoose";
import type { InvoiceDocument, VerificationResult } from "../invoices/invoice.types";
import type { RiskContext, VendorContext, POContext, HistoricalContext } from "./context.types";
import { createAnomalyContextFromRiskContext } from "./context.adapter";
import { anomalyEngine } from "../anomaly/anomaly.engine.instance";
import type { AnomalyResult } from "../anomaly/anomaly.types";
import { Vendor } from "../../models/Vendor";
import { Invoice } from "../../models/Invoice";

// GSTIN format: 2 digits + 5 chars + 4 digits + 1 char + 1 char + Z + 1 char
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

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

    // Step 1: Verify GST (format check and vendor match)
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
    if (invoice.vendorId || invoice.vendorName) {
      try {
        vendor = await this.gatherVendorContext(invoice.vendorId || "", invoice.vendorName || undefined);
      } catch (error) {
        errors.push({
          step: "VENDOR_CONTEXT",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    // Step 3: Gather PO context
    let po: POContext | undefined;
    if (invoice.poId || invoice.poNumber) {
      try {
        po = await this.gatherPOContext(invoice.poId || invoice.poNumber || "", invoice.vendorId || undefined);
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
   * Eliminates empty placeholder / false-positive success.
   */
  private async verifyGST(invoice: InvoiceDocument): Promise<VerificationResult> {
    const gstin = (invoice.gstin || "").trim().toUpperCase();

    if (!gstin) {
      return {
        gstFormatValid: false,
        gstVendorMatch: false,
        errors: ["GSTIN is missing on the invoice"],
      };
    }

    const formatValid = GSTIN_REGEX.test(gstin);
    if (!formatValid) {
      return {
        gstFormatValid: false,
        gstVendorMatch: false,
        errors: [`GSTIN format is invalid: ${gstin}`],
      };
    }

    // Look up vendor in database to check GSTIN match
    let vendorMatch = false;
    let vendorFound = false;

    if (mongoose.connection.readyState === 1 && (invoice.vendorId || invoice.vendorName)) {
      try {
        const query = mongoose.Types.ObjectId.isValid(invoice.vendorId || "")
          ? { _id: invoice.vendorId }
          : { name: invoice.vendorName };

        const matchedVendor = await Vendor.findOne(query);
        if (matchedVendor) {
          vendorFound = true;
          if (matchedVendor.gstin) {
            vendorMatch = matchedVendor.gstin.trim().toUpperCase() === gstin;
          }
        }
      } catch {
        // DB error or disconnected
      }
    }

    const errors: string[] = [];
    if (vendorFound && !vendorMatch) {
      errors.push("Invoice GSTIN does not match registered vendor GSTIN");
    }

    return {
      gstFormatValid: true,
      gstVendorMatch: vendorFound ? vendorMatch : undefined,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Gather vendor context: existence, GSTIN, active status, risk profile.
   * Database-backed check replacing hardcoded 'true' values.
   */
  private async gatherVendorContext(
    vendorId: string,
    vendorName?: string
  ): Promise<VendorContext> {
    if (mongoose.connection.readyState === 1) {
      try {
        let vendorDoc = null;
        if (mongoose.Types.ObjectId.isValid(vendorId)) {
          vendorDoc = await Vendor.findById(vendorId);
        }
        if (!vendorDoc && vendorName) {
          vendorDoc = await Vendor.findOne({ name: vendorName });
        }

        if (vendorDoc) {
          return {
            vendorId: vendorDoc._id.toString(),
            vendorName: vendorDoc.name,
            gstin: vendorDoc.gstin,
            gstinValid: Boolean(vendorDoc.gstin && GSTIN_REGEX.test(vendorDoc.gstin)),
            vendorExists: true,
            vendorActive: vendorDoc.status === "ACTIVE",
            vendorApproved: vendorDoc.isApproved,
            bankDetailsVerified: Boolean(vendorDoc.accountNumber && vendorDoc.ifscCode),
            createdAt: vendorDoc.createdAt,
            historicalInvoiceCount: vendorDoc.totalInvoices || 0,
            riskProfile: vendorDoc.isApproved ? "LOW" : "HIGH",
          };
        }
      } catch {
        // Fall back below
      }
    }

    // Explicit UNAVAILABLE / not-found state instead of hardcoded true
    return {
      vendorId: vendorId || "UNKNOWN",
      vendorName,
      vendorExists: false,
      vendorActive: false,
      vendorApproved: false,
      riskProfile: "HIGH",
    };
  }

  /**
   * Gather PO context: existence, vendor match, amounts, dates.
   * Replaces hardcoded true placeholder.
   */
  private async gatherPOContext(poId: string, vendorId?: string): Promise<POContext> {
    const poNumber = (poId || "").trim();

    if (!poNumber) {
      return {
        poId: "",
        poExists: false,
        poVendorMatch: false,
        poActive: false,
      };
    }

    // If MongoDB or ERP has PO data
    if (mongoose.connection.readyState === 1) {
      try {
        const poInvoice = await Invoice.findOne({ poNumber });
        if (poInvoice) {
          const uploaderVendor = poInvoice.vendorId?.toString();
          const matches = vendorId ? uploaderVendor === vendorId : true;

          return {
            poId: poNumber,
            poNumber,
            vendorId: uploaderVendor,
            poExists: true,
            poVendorMatch: matches,
            poActive: poInvoice.status !== "REJECTED",
            poAmount: poInvoice.totalAmount,
          };
        }
      } catch {
        // Fall through
      }
    }

    return {
      poId: poNumber,
      poNumber,
      poExists: false,
      poVendorMatch: false,
      poActive: false,
    };
  }

  /**
   * Gather historical context: previous invoices, anomalies, patterns.
   * Real database query replacing hardcoded 0 count.
   */
  private async gatherHistoricalContext(vendorId: string): Promise<HistoricalContext> {
    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(vendorId)) {
      try {
        const invoices = await Invoice.find({ vendorId }).sort({ createdAt: -1 }).limit(100);
        const count = invoices.length;
        const totalAmount = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
        const averageAmount = count > 0 ? totalAmount / count : 0;
        const lastInvoiceDate = invoices[0]?.invoiceDate || invoices[0]?.createdAt;

        return {
          vendorId,
          invoiceCount: count,
          averageAmount,
          lastInvoiceDate,
          invoices: invoices.map((inv) => ({
            id: inv._id.toString(),
            invoiceNumber: inv.invoiceNumber,
            vendorId: inv.vendorId?.toString(),
            vendorName: inv.vendorName,
            totalAmount: inv.totalAmount,
            invoiceDate: inv.invoiceDate,
            gstin: inv.gstin,
          })),
        };
      } catch {
        // Fall through
      }
    }

    return {
      vendorId,
      invoiceCount: 0,
      invoices: [],
    };
  }

  /**
   * Verify PO quantity aggregation.
   * Database-backed calculation across invoices for the same PO.
   */
  async verifyPOQuantityAggregation(
    vendorId: string,
    poId: string,
    currentInvoiceId: string
  ): Promise<number> {
    if (mongoose.connection.readyState === 1 && poId) {
      try {
        const query: any = { poNumber: poId };
        if (mongoose.Types.ObjectId.isValid(currentInvoiceId)) {
          query._id = { $ne: currentInvoiceId };
        }
        const invoices = await Invoice.find(query);
        let totalQuantity = 0;
        for (const inv of invoices) {
          if (inv.lineItems && Array.isArray(inv.lineItems)) {
            for (const item of inv.lineItems) {
              totalQuantity += item.quantity || 0;
            }
          }
        }
        return totalQuantity;
      } catch {
        return 0;
      }
    }
    return 0;
  }

  /**
   * Verify PO amount aggregation.
   * Database-backed calculation across invoices for the same PO.
   */
  async verifyPOAmountAggregation(
    vendorId: string,
    poId: string,
    currentInvoiceId: string
  ): Promise<number> {
    if (mongoose.connection.readyState === 1 && poId) {
      try {
        const query: any = { poNumber: poId };
        if (mongoose.Types.ObjectId.isValid(currentInvoiceId)) {
          query._id = { $ne: currentInvoiceId };
        }
        const invoices = await Invoice.find(query);
        return invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
      } catch {
        return 0;
      }
    }
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
