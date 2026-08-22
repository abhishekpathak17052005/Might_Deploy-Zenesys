/**
 * Invoice Processing Orchestrator
 * Central workflow that coordinates all verification and risk assessment steps.
 * Flow: extract → categorize → verify vendor → validate GST → verify PO → run anomaly → aggregate risk → generate evidence
 */

import type { StructuredInvoiceData } from "../extraction/extraction.types";
import type { InvoiceDocument } from "../invoices/invoice.types";
import { AnomalyEngine } from "../anomaly/anomaly.engine";
import { categorizationService } from "../categorization/categorization.service";
import { CATEGORY_GL_MAPPING } from "../categorization/categorization.keywords";
import { gstVerificationService } from "../verification/gst.service";
import { vendorVerificationService } from "../verification/vendor.service";
import { poVerificationService } from "../verification/po.service";
import { erpProvider } from "../verification/erp.provider";

export interface ProcessingContext {
  invoice: StructuredInvoiceData;
  document: InvoiceDocument;
  historicalInvoices: InvoiceDocument[];
  recentInvoices: InvoiceDocument[];
}

export interface ProcessingResult {
  success: boolean;
  invoiceId: string;
  status:
    | "EXTRACTION_COMPLETE"
    | "CATEGORIZATION_COMPLETE"
    | "VERIFICATION_COMPLETE"
    | "RISK_EVALUATED"
    | "PROCESSING_FAILED";
  extraction: {
    invoiceNumber?: string;
    vendorName?: string;
    amount: number;
    invoiceDate?: string;
    poNumber?: string;
    gstin?: string;
  };
  categorization: {
    category: string;
    confidence: number;
    glAccount?: string;
    method: string;
  };
  verification: {
    vendor: {
      exists: boolean;
      active: boolean;
      approved: boolean;
      message: string;
    };
    gst: {
      formatValid: boolean;
      vendorMatch: boolean;
      message: string;
      officialVerificationAvailable: boolean;
    };
    po: {
      found: boolean;
      vendorMatch: boolean;
      amountWithinBalance: boolean;
      message: string;
    };
  };
  erp: {
    source: string;
    vendor?: Record<string, unknown>;
    purchaseOrder?: Record<string, unknown>;
    glAccount?: Record<string, unknown>;
  };
  risk: {
    score: number;
    level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    decision: "ELIGIBLE_FOR_AUTO_PROCESSING" | "REVIEW_REQUIRED" | "BLOCKED";
    signals: Array<{
      rule: string;
      severity: string;
      message: string;
    }>;
  };
  evidence: Array<{
    type: string;
    rule?: string;
    severity?: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  }>;
  warnings: string[];
  errors: string[];
}

export class InvoiceProcessingOrchestrator {
  private anomalyEngine: AnomalyEngine;

  constructor() {
    this.anomalyEngine = new AnomalyEngine();
  }

  /**
   * Process invoice through complete verification workflow.
   */
  async process(context: ProcessingContext): Promise<ProcessingResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    console.info("orchestrator.processing.started", {
      documentId: context.document.id,
      invoiceNumber: context.invoice.invoiceNumber
    });

    // Initialize result
    const result: ProcessingResult = {
      success: false,
      invoiceId: context.document.id,
      status: "EXTRACTION_COMPLETE",
      extraction: {
        invoiceNumber: context.invoice.invoiceNumber,
        vendorName: context.invoice.vendorName,
        amount: context.invoice.total,
        invoiceDate: context.invoice.invoiceDate?.toISOString(),
        poNumber: context.invoice.poNumber || undefined,
        gstin: context.invoice.gstin || undefined
      },
      categorization: {
        category: "Unknown",
        confidence: 0,
        method: "RULE_BASED"
      },
      verification: {
        vendor: { exists: false, active: false, approved: false, message: "" },
        gst: { formatValid: false, vendorMatch: false, message: "", officialVerificationAvailable: false },
        po: { found: false, vendorMatch: false, amountWithinBalance: false, message: "" }
      },
      erp: { source: "NETSUITE_MOCK" },
      risk: { score: 0, level: "LOW", decision: "ELIGIBLE_FOR_AUTO_PROCESSING", signals: [] },
      evidence: [],
      warnings,
      errors
    };

    try {
      // Step 1: Categorization
      console.info("orchestrator.step", { step: "categorization" });
      const categorization = categorizationService.categorize({
        vendorName: context.invoice.vendorName,
        description: context.invoice.invoiceNumber,
        lineItems: context.invoice.items?.map((item) => ({ description: item.description }))
      });

      result.categorization = {
        category: categorization.category,
        confidence: categorization.confidence,
        glAccount: CATEGORY_GL_MAPPING[categorization.category],
        method: categorization.method || "RULE_BASED"
      };

      result.evidence.push({
        type: "CATEGORIZATION",
        title: `Invoice categorized as ${categorization.category}`,
        message: categorization.reason,
        data: {
          category: categorization.category,
          confidence: categorization.confidence,
          signals: categorization.matchedSignals
        }
      });

      // Step 2: Vendor Verification
      console.info("orchestrator.step", { step: "vendor_verification" });
      const vendorVerification = vendorVerificationService.verify({
        vendorName: context.invoice.vendorName,
        gstin: context.invoice.gstin,
        expectedVendorName: context.invoice.vendorName
      });

      result.verification.vendor = {
        exists: vendorVerification.vendorExists,
        active: vendorVerification.vendorActive,
        approved: vendorVerification.vendorApproved,
        message: vendorVerification.message
      };

      if (!vendorVerification.vendorExists) {
        warnings.push(`Vendor "${context.invoice.vendorName}" not found in master - new vendor`);
      } else if (!vendorVerification.vendorActive) {
        errors.push(`Vendor is ${vendorVerification.vendorStatus}`);
      } else if (!vendorVerification.vendorApproved) {
        warnings.push(`Vendor approval status: ${vendorVerification.vendorApprovalStatus}`);
      }

      if (vendorVerification.vendorExists) {
        result.evidence.push({
          type: "VENDOR_VERIFICATION",
          title: "Vendor Verification",
          message: vendorVerification.message,
          data: vendorVerification.evidence
        });
      }

      // Step 3: GST Verification
      console.info("orchestrator.step", { step: "gst_verification" });
      const gstVerification = gstVerificationService.verify({
        gstin: context.invoice.gstin,
        vendorName: context.invoice.vendorName
      });

      result.verification.gst = {
        formatValid: gstVerification.formatValid,
        vendorMatch: gstVerification.vendorMatch,
        message: gstVerification.message,
        officialVerificationAvailable: gstVerification.officialVerificationAvailable
      };

      if (!gstVerification.formatValid) {
        errors.push(`GSTIN format invalid: ${context.invoice.gstin}`);
      } else if (!gstVerification.vendorMatch && gstVerification.status === "VENDOR_MISMATCH") {
        errors.push(`GSTIN does not match vendor master`);
      }

      result.evidence.push({
        type: "GST_VERIFICATION",
        title: "GSTIN Verification",
        message: gstVerification.message,
        data: {
          gstin: gstVerification.gstin,
          formatValid: gstVerification.formatValid,
          vendorMatch: gstVerification.vendorMatch,
          status: gstVerification.status,
          officialVerificationAvailable: gstVerification.officialVerificationAvailable
        }
      });

      // Step 4: PO Verification
      console.info("orchestrator.step", { step: "po_verification" });
      const poVerification = poVerificationService.verify({
        poNumber: context.invoice.poNumber,
        vendorName: context.invoice.vendorName,
        invoiceAmount: context.invoice.total,
        invoiceQuantity: context.invoice.items?.reduce((sum, item) => sum + (item.quantity || 0), 0)
      });

      result.verification.po = {
        found: poVerification.poFound,
        vendorMatch: poVerification.vendorMatch,
        amountWithinBalance: poVerification.amountWithinBalance,
        message: poVerification.message
      };

      if (!poVerification.poFound && context.invoice.poNumber) {
        errors.push(`PO "${context.invoice.poNumber}" not found`);
      } else if (poVerification.poFound && !poVerification.vendorMatch) {
        errors.push(`PO vendor does not match invoice vendor`);
      } else if (poVerification.poFound && !poVerification.amountWithinBalance) {
        errors.push(`Invoice amount exceeds PO remaining balance`);
      }

      if (poVerification.poFound) {
        result.evidence.push({
          type: "PO_VERIFICATION",
          title: "Purchase Order Verification",
          message: poVerification.message,
          data: poVerification.evidence
        });
      }

      // Step 5: Load ERP Context
      console.info("orchestrator.step", { step: "erp_context" });
      if (vendorVerification.vendorExists && vendorVerification.vendorId) {
        const erpVendor = await erpProvider.getVendor(vendorVerification.vendorId);
        const erpPO = poVerification.poFound
          ? await erpProvider.getPurchaseOrder(poVerification.poNumber)
          : null;
        const glCode = CATEGORY_GL_MAPPING[categorization.category];
        const erpGLAccount = glCode ? await erpProvider.getGLAccount(glCode) : null;

        result.erp = {
          source: "NETSUITE_MOCK",
          vendor: erpVendor || undefined,
          purchaseOrder: erpPO || undefined,
          glAccount: erpGLAccount || undefined
        };
      }

      // Step 6: Run Anomaly Detection
      console.info("orchestrator.step", { step: "anomaly_detection" });
      const anomalyResult = await this.anomalyEngine.evaluate({
        invoice: {
          id: context.document.id,
          vendorName: context.invoice.vendorName,
          invoiceNumber: context.invoice.invoiceNumber,
          invoiceDate: context.invoice.invoiceDate,
          amount: context.invoice.total,
          poNumber: context.invoice.poNumber,
          gstin: context.invoice.gstin,
          items: (context.invoice.items || []).map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount
          }))
        },
        historicalInvoices: context.historicalInvoices || [],
        recentInvoices: context.recentInvoices || []
      });

      // Step 7: Aggregate Risk
      console.info("orchestrator.step", { step: "risk_aggregation" });
      result.risk = {
        score: anomalyResult.score,
        level: anomalyResult.level,
        decision: anomalyResult.decision,
        signals: anomalyResult.signals.map((signal) => ({
          rule: signal.type,
          severity: signal.severity,
          message: signal.message
        }))
      };

      // Add anomaly signals as evidence
      for (const signal of anomalyResult.signals) {
        result.evidence.push({
          type: "ANOMALY",
          rule: signal.type,
          severity: signal.severity,
          title: signal.title,
          message: signal.message,
          data: signal.data
        });
      }

      // Step 8: Final Status
      result.success = errors.length === 0;
      result.status = result.success ? "RISK_EVALUATED" : "PROCESSING_FAILED";

      if (result.success) {
        console.info("orchestrator.processing.success", {
          documentId: context.document.id,
          riskScore: result.risk.score,
          riskLevel: result.risk.level,
          durationMs: Date.now() - startTime
        });
      } else {
        console.error("orchestrator.processing.failed", {
          documentId: context.document.id,
          errors,
          durationMs: Date.now() - startTime
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push(`Processing error: ${message}`);
      result.success = false;
      result.status = "PROCESSING_FAILED";

      console.error("orchestrator.processing.exception", {
        documentId: context.document.id,
        error: message,
        durationMs: Date.now() - startTime
      });
    }

    result.errors = errors;
    result.warnings = warnings;
    return result;
  }
}

export const invoiceProcessingOrchestrator = new InvoiceProcessingOrchestrator();
