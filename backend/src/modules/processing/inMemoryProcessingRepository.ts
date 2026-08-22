import type { HistoricalInvoice, LineItemContext } from "../anomaly/anomaly.types";
import type { InvoiceCategorization } from "../categorization";
import type { ExtractionResult, StructuredInvoiceData } from "../extraction";
import type { InvoiceDocument } from "../invoices/invoice.types";
import type {
  InvoiceProcessingEvidence,
  InvoiceProcessingRepository,
  ProcessingPurchaseOrder,
  ProcessingVendor
} from "./invoiceProcessing.types";

type SeedInvoice = {
  document: InvoiceDocument;
  extractionRaw: unknown;
};

const now = new Date("2026-08-22T00:00:00.000Z");

function document(id: string, originalFilename: string, invoiceType: InvoiceDocument["invoiceType"] = "PO_BASED"): InvoiceDocument {
  return {
    id,
    invoiceNumber: null,
    uploaderUserId: "dev-procurement-user",
    vendorId: null,
    invoiceType,
    documentStatus: "SUBMITTED",
    storagePath: `dev-seed/${id}.json`,
    originalFilename,
    mimeType: "application/json",
    fileSizeBytes: 512,
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
    metadata: { extractionAttempts: 0 }
  };
}

function rawInvoice(input: {
  invoiceNumber: string;
  invoiceDate?: string;
  vendorName: string;
  gstin?: string | null;
  poNumber?: string | null;
  subtotal: number;
  tax: number;
  total: number;
  description?: string;
  quantity?: number;
  unitPrice?: number;
}): unknown {
  return {
    invoice_number: { value: input.invoiceNumber, confidence: 0.98 },
    invoice_date: { value: input.invoiceDate ?? "2026-08-20", confidence: 0.97 },
    vendor_name: { value: input.vendorName, confidence: 0.97 },
    gstin: { value: input.gstin ?? null, confidence: 0.96 },
    po_number: { value: input.poNumber ?? null, confidence: 0.95 },
    subtotal: { value: input.subtotal, confidence: 0.98 },
    tax: { value: input.tax, confidence: 0.98 },
    total: { value: input.total, confidence: 0.99 },
    due_date: { value: "2026-09-19", confidence: 0.92 },
    items: [
      {
        description: input.description ?? "Laptop docking station",
        quantity: input.quantity ?? 10,
        unit_price: input.unitPrice ?? input.subtotal / (input.quantity ?? 10),
        tax_rate: 18,
        amount: input.subtotal
      }
    ]
  };
}

const vendors: ProcessingVendor[] = [
  {
    id: "V-CLEAN",
    name: "Acme IT Supplies Pvt Ltd",
    legalName: "Acme IT Supplies Pvt Ltd",
    gstin: "27ABCDE1234F1Z5",
    email: "billing@acme.example",
    isActive: true,
    isApproved: true,
    bankDetailsVerified: true,
    approvedAt: "2026-01-10",
    createdAt: "2025-01-10"
  },
  {
    id: "V-SOFT",
    name: "CloudDesk Software Pvt Ltd",
    legalName: "CloudDesk Software Pvt Ltd",
    gstin: "29ABCDE1234F1Z3",
    email: "ap@clouddesk.example",
    isActive: true,
    isApproved: true,
    bankDetailsVerified: true,
    approvedAt: "2026-02-01",
    createdAt: "2025-06-01"
  }
];

const purchaseOrders: ProcessingPurchaseOrder[] = [
  {
    id: "PO-CLEAN",
    poNumber: "PO-1001",
    vendorId: "V-CLEAN",
    totalAmount: 59000,
    remainingAmount: 59000,
    status: "OPEN",
    poDate: "2026-08-01",
    lineItems: [{ sku: "DOCK-USB-C", description: "Laptop docking station", quantity: 10, amount: 50000 }]
  },
  {
    id: "PO-SOFT",
    poNumber: "PO-2001",
    vendorId: "V-SOFT",
    totalAmount: 118000,
    remainingAmount: 118000,
    status: "OPEN",
    poDate: "2026-08-01",
    lineItems: [{ sku: "SAAS-SEAT", description: "Software subscription", quantity: 100, amount: 100000 }]
  },
  {
    id: "PO-OTHER-VENDOR",
    poNumber: "PO-3001",
    vendorId: "V-SOFT",
    totalAmount: 59000,
    remainingAmount: 59000,
    status: "OPEN",
    poDate: "2026-08-01",
    lineItems: [{ sku: "DOCK-USB-C", description: "Laptop docking station", quantity: 10, amount: 50000 }]
  },
  {
    id: "PO-AMOUNT",
    poNumber: "PO-4001",
    vendorId: "V-CLEAN",
    totalAmount: 30000,
    remainingAmount: 30000,
    status: "OPEN",
    poDate: "2026-08-01",
    lineItems: [{ sku: "DOCK-USB-C", description: "Laptop docking station", quantity: 10, amount: 25424 }]
  },
  {
    id: "PO-SPLIT",
    poNumber: "PO-5001",
    vendorId: "V-CLEAN",
    totalAmount: 100000,
    remainingAmount: 100000,
    status: "OPEN",
    poDate: "2026-08-01",
    lineItems: [{ sku: "MARKETING-SERVICES", description: "Marketing campaign services", quantity: 100, amount: 84746 }]
  }
];

const historicalInvoices: HistoricalInvoice[] = [
  {
    id: "hist-clean-1",
    invoiceNumber: "HIST-100",
    vendorId: "V-CLEAN",
    vendorName: "Acme IT Supplies Pvt Ltd",
    poId: "PO-HIST-1",
    poNumber: "PO-HIST-1",
    totalAmount: 54000,
    invoiceDate: "2026-07-01",
    gstin: "27ABCDE1234F1Z5",
    lineItems: [{ sku: "DOCK-USB-C", description: "Laptop docking station", quantity: 9, amount: 45763 }]
  },
  {
    id: "hist-clean-2",
    invoiceNumber: "HIST-101",
    vendorId: "V-CLEAN",
    vendorName: "Acme IT Supplies Pvt Ltd",
    poId: "PO-HIST-2",
    poNumber: "PO-HIST-2",
    totalAmount: 59000,
    invoiceDate: "2026-06-01",
    gstin: "27ABCDE1234F1Z5",
    lineItems: [{ sku: "DOCK-USB-C", description: "Laptop docking station", quantity: 10, amount: 50000 }]
  },
  {
    id: "hist-clean-3",
    invoiceNumber: "HIST-102",
    vendorId: "V-CLEAN",
    vendorName: "Acme IT Supplies Pvt Ltd",
    poId: "PO-HIST-3",
    poNumber: "PO-HIST-3",
    totalAmount: 62000,
    invoiceDate: "2026-05-01",
    gstin: "27ABCDE1234F1Z5",
    lineItems: [{ sku: "DOCK-USB-C", description: "Laptop docking station", quantity: 10, amount: 52542 }]
  },
  {
    id: "hist-duplicate-clean",
    invoiceNumber: "INV-CLEAN-001",
    vendorId: "V-CLEAN",
    vendorName: "Acme IT Supplies Pvt Ltd",
    poId: "PO-HIST-DUP",
    poNumber: "PO-HIST-DUP",
    totalAmount: 12345,
    invoiceDate: "2026-07-15",
    gstin: "27ABCDE1234F1Z5",
    lineItems: [{ sku: "LEGACY-ITEM", description: "Legacy accessory", quantity: 1, amount: 10462 }]
  },
  {
    id: "hist-split-a",
    invoiceNumber: "INV-SPLIT-A",
    vendorId: "V-CLEAN",
    vendorName: "Acme IT Supplies Pvt Ltd",
    poId: "PO-SPLIT",
    poNumber: "PO-5001",
    totalAmount: 47000,
    invoiceDate: "2026-08-20",
    gstin: "27ABCDE1234F1Z5",
    lineItems: [{ sku: "MARKETING-SERVICES", description: "Marketing campaign services", quantity: 45, amount: 39830 }]
  },
  {
    id: "hist-split-b",
    invoiceNumber: "INV-SPLIT-B",
    vendorId: "V-CLEAN",
    vendorName: "Acme IT Supplies Pvt Ltd",
    poId: "PO-SPLIT",
    poNumber: "PO-5001",
    totalAmount: 48000,
    invoiceDate: "2026-08-21",
    gstin: "27ABCDE1234F1Z5",
    lineItems: [{ sku: "MARKETING-SERVICES", description: "Marketing campaign services", quantity: 45, amount: 40678 }]
  }
];

const seedInvoices: SeedInvoice[] = [
  {
    document: document("dev-clean-invoice", "clean-invoice.json"),
    extractionRaw: rawInvoice({
      invoiceNumber: "INV-CLEAN-002",
      vendorName: "Acme IT Supplies Pvt Ltd",
      gstin: "27ABCDE1234F1Z5",
      poNumber: "PO-1001",
      subtotal: 50000,
      tax: 9000,
      total: 59000
    })
  },
  {
    document: document("dev-duplicate-invoice", "duplicate-invoice.json"),
    extractionRaw: rawInvoice({
      invoiceNumber: "INV-CLEAN-001",
      vendorName: "Acme IT Supplies Pvt Ltd",
      gstin: "27ABCDE1234F1Z5",
      poNumber: "PO-1001",
      subtotal: 50000,
      tax: 9000,
      total: 59000
    })
  },
  {
    document: document("dev-po-mismatch", "po-mismatch.json"),
    extractionRaw: rawInvoice({
      invoiceNumber: "INV-PO-MISMATCH-001",
      vendorName: "Acme IT Supplies Pvt Ltd",
      gstin: "27ABCDE1234F1Z5",
      poNumber: "PO-3001",
      subtotal: 50000,
      tax: 9000,
      total: 59000
    })
  },
  {
    document: document("dev-amount-mismatch", "amount-mismatch.json"),
    extractionRaw: rawInvoice({
      invoiceNumber: "INV-AMOUNT-001",
      vendorName: "Acme IT Supplies Pvt Ltd",
      gstin: "27ABCDE1234F1Z5",
      poNumber: "PO-4001",
      subtotal: 50000,
      tax: 9000,
      total: 59000
    })
  },
  {
    document: document("dev-invalid-gstin", "invalid-gstin.json"),
    extractionRaw: rawInvoice({
      invoiceNumber: "INV-BAD-GST-001",
      vendorName: "Acme IT Supplies Pvt Ltd",
      gstin: "27BADGST",
      poNumber: "PO-1001",
      subtotal: 50000,
      tax: 9000,
      total: 59000
    })
  },
  {
    document: document("dev-new-vendor", "new-vendor.json", "NON_PO"),
    extractionRaw: rawInvoice({
      invoiceNumber: "INV-NEW-VENDOR-001",
      vendorName: "Unknown Vendor Labs",
      gstin: "07ABCDE1234F1Z1",
      poNumber: null,
      subtotal: 25000,
      tax: 4500,
      total: 29500,
      description: "Professional services",
      quantity: 1,
      unitPrice: 25000
    })
  },
  {
    document: document("dev-split-invoice", "split-invoice.json"),
    extractionRaw: rawInvoice({
      invoiceNumber: "INV-SPLIT-C",
      vendorName: "Acme IT Supplies Pvt Ltd",
      gstin: "27ABCDE1234F1Z5",
      poNumber: "PO-5001",
      subtotal: 40678,
      tax: 7322,
      total: 48000,
      description: "Marketing campaign services",
      quantity: 45,
      unitPrice: 903.9555555556
    })
  }
];

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function invoiceLineItems(invoice: StructuredInvoiceData): LineItemContext[] {
  return invoice.items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    amount: item.amount
  }));
}

export class InMemoryInvoiceProcessingRepository implements InvoiceProcessingRepository {
  private readonly documents = new Map<string, InvoiceDocument>();
  private readonly rawDocuments = new Map<string, unknown>();
  readonly processingUpdates = new Map<string, unknown>();

  constructor(
    seed: SeedInvoice[] = seedInvoices,
    private readonly vendorSeed: ProcessingVendor[] = vendors,
    private readonly poSeed: ProcessingPurchaseOrder[] = purchaseOrders,
    private readonly invoiceHistory: HistoricalInvoice[] = historicalInvoices
  ) {
    for (const item of seed) {
      this.documents.set(item.document.id, { ...item.document });
      this.rawDocuments.set(item.document.id, item.extractionRaw);
    }
  }

  async getInvoiceDocument(documentId: string): Promise<InvoiceDocument | null> {
    const document = this.documents.get(documentId);
    return document ? { ...document } : null;
  }

  async getDocumentBuffer(document: InvoiceDocument): Promise<Buffer> {
    const raw = this.rawDocuments.get(document.id);
    if (!raw) throw new Error(`Seed document buffer not found: ${document.id}`);
    return Buffer.from(JSON.stringify(raw), "utf8");
  }

  async updateInvoiceAfterExtraction(
    document: InvoiceDocument,
    extraction: ExtractionResult,
    category: InvoiceCategorization,
    attempts: number
  ): Promise<InvoiceDocument> {
    const vendor = await this.findVendorForInvoice(extraction.invoice, document.vendorId);
    const po = await this.findPurchaseOrderForInvoice(extraction.invoice);
    const updated: InvoiceDocument = {
      ...document,
      documentStatus: "EXTRACTION_COMPLETE",
      invoiceNumber: extraction.invoice.invoiceNumber,
      vendorId: vendor?.id ?? document.vendorId ?? null,
      vendorName: extraction.invoice.vendorName,
      gstin: extraction.invoice.gstin ?? null,
      poId: po?.id ?? null,
      poNumber: extraction.invoice.poNumber ?? null,
      invoiceDate: extraction.invoice.invoiceDate,
      dueDate: extraction.invoice.dueDate ?? null,
      subtotal: extraction.invoice.subtotal,
      taxAmount: extraction.invoice.tax,
      totalAmount: extraction.invoice.total,
      currency: "INR",
      lineItems: invoiceLineItems(extraction.invoice).map((item) => ({
        id: item.id,
        sku: item.sku ?? undefined,
        description: item.description ?? undefined,
        quantity: item.quantity ?? undefined,
        total: item.amount ?? undefined
      })),
      rawExtractionResult: extraction.raw,
      extractionConfidence: extraction.confidence as unknown as Record<string, unknown>,
      extractionValidation: {
        status: extraction.validation.status,
        findings: extraction.validation.findings.map((finding) => ({ ...finding }))
      },
      extractedAt: extraction.extractedAt,
      extractionProvider: { provider: extraction.provider, model: extraction.model },
      category,
      updatedAt: new Date(),
      metadata: {
        ...(document.metadata ?? {}),
        extractionAttempts: attempts,
        lastExtractionAt: extraction.extractedAt.toISOString(),
        extractionProvider: extraction.provider,
        extractionModel: extraction.model
      }
    };
    this.documents.set(document.id, updated);
    return { ...updated };
  }

  async updateInvoiceProcessingResult(
    invoiceId: string,
    update: Partial<InvoiceDocument> & { riskContext?: unknown; evidence?: InvoiceProcessingEvidence }
  ): Promise<void> {
    const existing = this.documents.get(invoiceId);
    if (!existing) throw new Error(`Invoice document not found: ${invoiceId}`);
    this.documents.set(invoiceId, { ...existing, ...update, updatedAt: new Date() });
    this.processingUpdates.set(invoiceId, update);
  }

  async findVendorForInvoice(invoice: StructuredInvoiceData, existingVendorId?: string | null): Promise<ProcessingVendor | null> {
    if (existingVendorId) {
      const byId = this.vendorSeed.find((vendor) => vendor.id === existingVendorId);
      if (byId) return byId;
    }

    const invoiceGstin = normalize(invoice.gstin);
    if (invoiceGstin) {
      const byGstin = this.vendorSeed.find((vendor) => normalize(vendor.gstin) === invoiceGstin);
      if (byGstin) return byGstin;
    }

    const invoiceVendorName = normalize(invoice.vendorName);
    return (
      this.vendorSeed.find((vendor) =>
        [vendor.name, vendor.legalName].some((name) => normalize(name).includes(invoiceVendorName) || invoiceVendorName.includes(normalize(name)))
      ) ?? null
    );
  }

  async findPurchaseOrderForInvoice(invoice: StructuredInvoiceData): Promise<ProcessingPurchaseOrder | null> {
    const poNumber = normalize(invoice.poNumber);
    if (!poNumber) return null;
    const po = this.poSeed.find((item) => normalize(item.poNumber) === poNumber || normalize(item.id) === poNumber);
    return po ? { ...po, lineItems: po.lineItems.map((item) => ({ ...item })) } : null;
  }

  async findHistoricalInvoices(vendorId: string, currentInvoiceId: string): Promise<HistoricalInvoice[]> {
    return this.invoiceHistory
      .filter((invoice) => invoice.vendorId === vendorId && invoice.id !== currentInvoiceId)
      .map((invoice) => ({ ...invoice, lineItems: invoice.lineItems?.map((item) => ({ ...item })) }));
  }

  async findPreviousInvoicesForPo(vendorId: string, poIdOrNumber: string, currentInvoiceId: string): Promise<HistoricalInvoice[]> {
    return this.invoiceHistory
      .filter((invoice) => {
        const poMatches = invoice.poId === poIdOrNumber || invoice.poNumber === poIdOrNumber;
        return invoice.vendorId === vendorId && poMatches && invoice.id !== currentInvoiceId;
      })
      .map((invoice) => ({ ...invoice, lineItems: invoice.lineItems?.map((item) => ({ ...item })) }));
  }
}

export const inMemoryInvoiceProcessingRepository = new InMemoryInvoiceProcessingRepository();
