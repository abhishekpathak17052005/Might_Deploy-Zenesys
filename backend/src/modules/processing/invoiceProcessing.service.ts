import { isValidIndianGstin, normalizeGstin, normalizeText } from "../anomaly/anomaly.helpers";
import type { AnomalyResult, HistoricalInvoice } from "../anomaly/anomaly.types";
import { CategorizationService, categorizationService, type InvoiceCategorization } from "../categorization";
import { contextService, type RiskContext } from "../context";
import { explanationService } from "../explanation";
import { ExtractionService, extractionService, structuredInvoiceSchema, type StructuredInvoiceData } from "../extraction";
import type { InvoiceDocument, RiskResult, VerificationResult } from "../invoices/invoice.types";
import { inMemoryInvoiceProcessingRepository } from "./inMemoryProcessingRepository";
import type {
  EmailProvider,
  GstinVerificationResult,
  InvoiceProcessingEvidence,
  InvoiceProcessingRepository,
  InvoiceProcessingResponse,
  PoVerificationResult,
  ProcessingCategoryCode,
  ProcessingPurchaseOrder,
  ProcessingVendor,
  VendorVerificationResult
} from "./invoiceProcessing.types";
import { mockEmailProvider } from "./mockEmailProvider";
import { KeywordCategorizationProvider } from "./mockCategorizationProvider";
import { JsonBufferExtractionProvider } from "./mockExtractionProvider";

const CATEGORY_CODE_BY_LABEL: Record<string, ProcessingCategoryCode> = {
  "IT Equipment": "IT_EQUIPMENT",
  "Software / SaaS": "SOFTWARE_SAAS",
  "Office Supplies": "OFFICE_SUPPLIES",
  Travel: "TRAVEL",
  "Professional Services": "PROFESSIONAL_SERVICES",
  Utilities: "UTILITIES",
  Maintenance: "MAINTENANCE",
  Marketing: "MARKETING",
  Other: "OTHER"
};

function toDateOnly(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function lineItemsFromInvoice(invoice: InvoiceDocument) {
  return (invoice.lineItems ?? []).map((item) => ({
    id: item.id,
    sku: item.sku,
    description: item.description,
    quantity: item.quantity,
    amount: item.total
  }));
}

function sumQuantities(items: Array<{ quantity?: number | null }>): number {
  return items.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
}

export class InvoiceProcessingService {
  constructor(
    private readonly repository: InvoiceProcessingRepository = inMemoryInvoiceProcessingRepository,
    private readonly extractor: ExtractionService = extractionService,
    private readonly categorizer = categorizationService,
    private readonly emailProvider: EmailProvider = mockEmailProvider
  ) {}

  async getInvoiceDocument(documentId: string): Promise<InvoiceDocument | null> {
    return this.repository.getInvoiceDocument(documentId);
  }

  async process(documentId: string): Promise<InvoiceProcessingResponse> {
    const document = await this.repository.getInvoiceDocument(documentId);
    if (!document) {
      throw new Error(`Invoice document not found: ${documentId}`);
    }

    const attempts = (document.metadata?.extractionAttempts ?? 0) + 1;
    const documentBuffer = await this.repository.getDocumentBuffer(document);
    if (documentBuffer.length === 0) {
      throw new Error("Invoice document is empty");
    }

    const extraction = await this.extractor.extract({
      documentBuffer,
      mimeType: document.mimeType,
      filename: document.originalFilename
    });
    const schemaValidation = structuredInvoiceSchema.safeParse(extraction.invoice);
    if (!schemaValidation.success) {
      extraction.validation = {
        status: "INVALID",
        findings: [
          ...extraction.validation.findings,
          ...schemaValidation.error.issues.map((issue) => ({
            type: "EXTRACTION_SCHEMA_ERROR" as const,
            field: issue.path.join("."),
            message: issue.message,
            evidence: { code: issue.code }
          }))
        ]
      };
    }

    const category = await this.categorize(extraction.invoice);
    const enrichedInvoice = await this.repository.updateInvoiceAfterExtraction(document, extraction, category, attempts);
    const vendor = await this.repository.findVendorForInvoice(extraction.invoice, enrichedInvoice.vendorId);
    const purchaseOrder = await this.repository.findPurchaseOrderForInvoice(extraction.invoice);
    const vendorVerification = this.verifyVendor(extraction.invoice, vendor);
    const gstVerification = this.verifyGstin(extraction.invoice, vendor);
    const poVerification = await this.verifyPurchaseOrder(enrichedInvoice, purchaseOrder);

    const invoiceForRisk = this.applyVerificationIds(enrichedInvoice, vendor, purchaseOrder);
    const historicalInvoices = vendor?.id
      ? await this.repository.findHistoricalInvoices(vendor.id, invoiceForRisk.id)
      : [];

    const riskContext = this.buildRiskContext(
      invoiceForRisk,
      vendor,
      purchaseOrder,
      historicalInvoices,
      vendorVerification,
      gstVerification,
      poVerification
    );

    const anomalyResult = await contextService.evaluateRisk(riskContext);
    const explanation = explanationService.generateInvoiceExplanation(invoiceForRisk.id, anomalyResult);
    const evidence = this.buildEvidence(extraction, vendorVerification, gstVerification, poVerification, anomalyResult, explanation);
    const riskResult = this.toRiskResult(anomalyResult);

    await this.repository.updateInvoiceProcessingResult(invoiceForRisk.id, {
      documentStatus: "FINANCE_REVIEW_PENDING",
      verificationResult: riskContext.verification,
      verificationCompleteAt: new Date(),
      riskResult,
      riskEvaluatedAt: new Date(),
      riskContext,
      evidence
    });

    const notification = await this.emailProvider.notifyFinanceManager({
      invoiceId: invoiceForRisk.id,
      riskLevel: anomalyResult.risk.level,
      riskScore: anomalyResult.risk.score,
      signalCount: anomalyResult.signals.length
    });

    return {
      invoiceId: invoiceForRisk.id,
      status: "FINANCE_REVIEW_PENDING",
      extraction,
      category: {
        code: CATEGORY_CODE_BY_LABEL[category.category] ?? "OTHER",
        source: category
      },
      validation: extraction.validation,
      vendorVerification,
      gstVerification,
      poVerification,
      risk: {
        score: anomalyResult.risk.score,
        level: anomalyResult.risk.level,
        decision: anomalyResult.decision.status,
        findings: anomalyResult.signals,
        metadata: anomalyResult.metadata
      },
      evidence,
      notification
    };
  }

  private async categorize(invoice: StructuredInvoiceData): Promise<InvoiceCategorization> {
    try {
      return await this.categorizer.categorize(invoice);
    } catch (error) {
      return {
        category: "Other",
        confidence: 0,
        reason: error instanceof Error ? `Categorization failed: ${error.message}` : "Categorization failed.",
        status: "FAILED",
        provider: "gemini",
        model: process.env.GEMINI_CATEGORIZATION_MODEL ?? process.env.GEMINI_EXTRACTION_MODEL ?? "gemini-1.5-flash",
        categorizedAt: new Date()
      };
    }
  }

  private verifyVendor(invoice: StructuredInvoiceData, vendor: ProcessingVendor | null): VendorVerificationResult {
    const invoiceName = normalizeText(invoice.vendorName);
    const vendorName = normalizeText(vendor?.name);
    const legalName = normalizeText(vendor?.legalName);
    const invoiceGstin = normalizeGstin(invoice.gstin);
    const vendorGstin = normalizeGstin(vendor?.gstin);
    const vendorIdentityMatch = Boolean(vendor && invoiceName && (invoiceName === vendorName || invoiceName === legalName));
    const gstinMatch = Boolean(invoiceGstin && vendorGstin && invoiceGstin === vendorGstin);

    return {
      vendorExists: Boolean(vendor),
      activeStatus: vendor?.isActive === true,
      approvedStatus: vendor?.isApproved === true,
      vendorIdentityMatch,
      gstinMatch,
      matchedVendorId: vendor?.id,
      evidence: [
        { check: "vendor_exists", actual: vendor?.id ?? null, expected: "vendor master record" },
        { check: "active_status", actual: vendor?.isActive ?? null, expected: true },
        { check: "approved_status", actual: vendor?.isApproved ?? null, expected: true },
        { check: "vendor_identity_match", actual: invoice.vendorName, expected: vendor?.legalName ?? vendor?.name ?? null },
        { check: "gstin_match", actual: invoiceGstin || null, expected: vendorGstin || null }
      ]
    };
  }

  private verifyGstin(invoice: StructuredInvoiceData, vendor: ProcessingVendor | null): GstinVerificationResult {
    const invoiceGstin = normalizeGstin(invoice.gstin);
    const vendorGstin = normalizeGstin(vendor?.gstin);
    const formatValid = Boolean(invoiceGstin && isValidIndianGstin(invoiceGstin));
    const vendorMatch = Boolean(formatValid && vendorGstin && invoiceGstin === vendorGstin);

    return {
      statuses: [
        formatValid ? "VALID_FORMAT" : "INVALID_FORMAT",
        vendorMatch ? "VENDOR_MATCH" : "VENDOR_MISMATCH",
        "OFFICIAL_VERIFICATION_UNAVAILABLE"
      ],
      formatValid,
      vendorMatch,
      officialVerificationAvailable: false,
      evidence: [
        { check: "gstin_format", actual: invoiceGstin || null, expected: "15-character Indian GSTIN pattern" },
        { check: "vendor_gstin_match", actual: invoiceGstin || null, expected: vendorGstin || null },
        { check: "official_verification", actual: "unavailable", expected: "official GST API not configured" }
      ]
    };
  }

  private async verifyPurchaseOrder(
    invoice: InvoiceDocument,
    purchaseOrder: ProcessingPurchaseOrder | null
  ): Promise<PoVerificationResult> {
    const vendorId = invoice.vendorId ?? "";
    const poReference = purchaseOrder?.id ?? invoice.poId ?? invoice.poNumber ?? "";
    const previousInvoices = vendorId && poReference
      ? await this.repository.findPreviousInvoicesForPo(vendorId, poReference, invoice.id)
      : [];
    const previousAmount = previousInvoices.reduce((sum, item) => sum + (item.totalAmount ?? 0), 0);
    const invoiceAmount = invoice.totalAmount ?? 0;
    const poTotal = purchaseOrder?.totalAmount ?? 0;
    const remainingAmount = purchaseOrder?.remainingAmount ?? Math.max(poTotal - previousAmount, 0);
    const poQuantity = sumQuantities(purchaseOrder?.lineItems ?? []);
    const previousQuantity = previousInvoices.reduce((sum, item) => sum + sumQuantities(item.lineItems ?? []), 0);
    const invoiceQuantity = sumQuantities(invoice.lineItems ?? []);

    return {
      poExists: Boolean(purchaseOrder),
      poBelongsToVendor: Boolean(purchaseOrder && invoice.vendorId && purchaseOrder.vendorId === invoice.vendorId),
      invoiceAmountWithinPo: Boolean(purchaseOrder && invoiceAmount <= poTotal),
      remainingPoAmountSufficient: Boolean(purchaseOrder && invoiceAmount <= remainingAmount),
      quantityWithinPo: Boolean(!purchaseOrder || poQuantity === 0 || invoiceQuantity + previousQuantity <= poQuantity),
      previousInvoices,
      matchedPoId: purchaseOrder?.id,
      evidence: [
        { check: "po_exists", actual: purchaseOrder?.poNumber ?? null, expected: invoice.poNumber ?? invoice.poId ?? null },
        { check: "po_vendor_match", actual: invoice.vendorId ?? null, expected: purchaseOrder?.vendorId ?? null },
        { check: "invoice_amount", actual: invoiceAmount, expected: poTotal || null },
        { check: "remaining_po_amount", actual: invoiceAmount, expected: remainingAmount || null },
        { check: "quantity", actual: invoiceQuantity + previousQuantity, expected: poQuantity || null },
        { check: "previous_invoices", actual: previousInvoices.map((item) => item.id), expected: "related invoices considered" }
      ]
    };
  }

  private applyVerificationIds(
    invoice: InvoiceDocument,
    vendor: ProcessingVendor | null,
    purchaseOrder: ProcessingPurchaseOrder | null
  ): InvoiceDocument {
    return {
      ...invoice,
      vendorId: vendor?.id ?? invoice.vendorId ?? null,
      poId: purchaseOrder?.id ?? invoice.poId ?? null
    };
  }

  private buildRiskContext(
    invoice: InvoiceDocument,
    vendor: ProcessingVendor | null,
    purchaseOrder: ProcessingPurchaseOrder | null,
    historicalInvoices: HistoricalInvoice[],
    vendorVerification: VendorVerificationResult,
    gstVerification: GstinVerificationResult,
    poVerification: PoVerificationResult
  ): RiskContext {
    const verification: VerificationResult = {
      gstFormatValid: gstVerification.formatValid,
      gstVendorMatch: gstVerification.vendorMatch,
      vendorExists: vendorVerification.vendorExists,
      vendorActive: vendorVerification.activeStatus,
      poFound: poVerification.poExists,
      poVendorMatch: poVerification.poBelongsToVendor,
      errors: [
        ...vendorVerification.evidence.filter((item) => item.actual !== item.expected).map((item) => String(item.check)),
        ...gstVerification.statuses.filter((status) => status !== "VALID_FORMAT" && status !== "VENDOR_MATCH" && status !== "OFFICIAL_VERIFICATION_UNAVAILABLE"),
        ...poVerification.evidence.filter((item) => item.actual !== item.expected).map((item) => String(item.check))
      ]
    };

    return {
      invoice,
      verification,
      vendor: vendor
        ? {
            vendorId: vendor.id,
            vendorName: vendor.name,
            legalName: vendor.legalName,
            gstin: vendor.gstin ?? undefined,
            vendorExists: true,
            vendorActive: vendor.isActive,
            vendorApproved: vendor.isApproved,
            vendorTaxRegistered: vendor.isApproved,
            bankDetailsVerified: vendor.bankDetailsVerified,
            bankDetailsUpdatedAt: vendor.bankDetailsUpdatedAt,
            approvedAt: vendor.approvedAt,
            createdAt: vendor.createdAt
          }
        : undefined,
      po: purchaseOrder
        ? {
            poId: purchaseOrder.id,
            poNumber: purchaseOrder.poNumber,
            vendorId: purchaseOrder.vendorId,
            poVendorMatch: poVerification.poBelongsToVendor,
            poExists: true,
            poActive: purchaseOrder.status === "OPEN",
            poAmount: purchaseOrder.totalAmount,
            remainingAmount: purchaseOrder.remainingAmount,
            poDate: purchaseOrder.poDate ? new Date(purchaseOrder.poDate) : undefined,
            poStatus: purchaseOrder.status,
            lineItems: purchaseOrder.lineItems
          }
        : undefined,
      history: {
        vendorId: invoice.vendorId ?? vendor?.id ?? "UNKNOWN",
        invoiceCount: historicalInvoices.length,
        invoices: historicalInvoices,
        recentInvoices: poVerification.previousInvoices,
        averageAmount: historicalInvoices.length
          ? historicalInvoices.reduce((sum, item) => sum + (item.totalAmount ?? 0), 0) / historicalInvoices.length
          : undefined,
        lastInvoiceDate: historicalInvoices[0]?.invoiceDate ? new Date(historicalInvoices[0].invoiceDate) : undefined
      },
      contextBuiltAt: new Date(),
      contextVersion: "1.1"
    };
  }

  private buildEvidence(
    extraction: { validation: { findings: Array<object> } },
    vendorVerification: VendorVerificationResult,
    gstVerification: GstinVerificationResult,
    poVerification: PoVerificationResult,
    anomalyResult: AnomalyResult,
    explanation: unknown
  ): InvoiceProcessingEvidence {
    return {
      validation: extraction.validation.findings.map((finding) => ({ ...finding })),
      vendorVerification: vendorVerification.evidence,
      gstVerification: gstVerification.evidence,
      poVerification: poVerification.evidence,
      riskSignals: anomalyResult.signals.map((signal) => ({
        ...signal,
        explanation: explanationService.generateSignalExplanation(signal)
      })),
      explanation
    };
  }

  private toRiskResult(anomalyResult: AnomalyResult): RiskResult {
    return {
      riskScore: anomalyResult.risk.score,
      riskLevel: anomalyResult.risk.level,
      decision: anomalyResult.decision.status,
      signals: anomalyResult.signals.map((signal) => ({
        type: signal.type,
        severity: signal.severity,
        message: signal.message
      }))
    };
  }
}

export const invoiceProcessingService = new InvoiceProcessingService(
  inMemoryInvoiceProcessingRepository,
  new ExtractionService(new JsonBufferExtractionProvider()),
  new CategorizationService(new KeywordCategorizationProvider()),
  mockEmailProvider
);
