import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { Types } from "mongoose";
import { Invoice } from "../../../models/Invoice";
import { compareVendorIdentity } from "../../../services/InvoiceService";
import { AnomalyEngine } from "../../anomaly/anomaly.engine";
import { ExtractionService } from "../extraction.service";
import { GeminiExtractionProvider } from "../geminiExtractionProvider";
import type { InvoiceExtractionProvider } from "../extraction.types";

const cateringOCR = {
  invoice_number: { value: "OM-1007", confidence: 0.98 },
  invoice_date: { value: "2026-10-16", confidence: 0.96 },
  vendor_name: { value: "OM Caterers", confidence: 0.98 },
  gstin: { value: null, confidence: 0.9 },
  po_number: { value: null, confidence: 0.9 },
  subtotal: { value: 100000, confidence: 0.97 },
  tax: { value: 0, confidence: 0.95 },
  total: { value: 100000, confidence: 0.99 },
  due_date: { value: null, confidence: 0.8 },
  items: [{ description: "Catering and food services for 1,000 persons", quantity: 1000, unit_price: 100, tax_rate: 0, amount: 100000 }],
};

class StaticProvider implements InvoiceExtractionProvider {
  constructor(private readonly result: unknown) {}
  async extractInvoice(): Promise<unknown> { return this.result; }
}

describe("invoice document mismatch regression", () => {
  it("does not invent sample fields when Gemini is unavailable", async () => {
    const provider = new GeminiExtractionProvider(undefined);
    await assert.rejects(
      provider.extractInvoice({ documentBuffer: Buffer.from("uploaded catering bill"), mimeType: "application/pdf", filename: "om-caterers.pdf" }),
      /not configured/,
    );
  });

  it("extracts catering description and amount from the same upload bytes", async () => {
    const original = Buffer.from("synthetic-catering-invoice: OM Caterers, Catering and food services, 1000 persons, INR 100000");
    const result = await new ExtractionService(new StaticProvider(cateringOCR)).extract({
      documentBuffer: original,
      mimeType: "application/pdf",
      filename: "om-caterers.pdf",
    });
    const attachmentSha256 = createHash("sha256").update(original).digest("hex");
    const record = new Invoice({
      _id: new Types.ObjectId(),
      organizationId: new Types.ObjectId(),
      vendorId: new Types.ObjectId(),
      uploadedBy: new Types.ObjectId(),
      vendorName: "OM Caterers",
      attachmentData: original,
      attachmentSha256,
      attachmentMimeType: "application/pdf",
      invoiceNumber: result.invoice.invoiceNumber,
      totalAmount: result.invoice.total,
      description: result.invoice.items.map((item) => item.description).join(", "),
    });

    assert.equal(createHash("sha256").update(record.attachmentData!).digest("hex"), attachmentSha256);
    assert.match(record.description!, /catering|food services/i);
    assert.doesNotMatch(record.description!, /software/i);
    assert.equal(record.totalAmount, 100000);
    assert.equal(record.invoiceNumber, "OM-1007");
  });

  it("uses only the registered vendor mapping to establish identity", () => {
    assert.equal(compareVendorIdentity("OM Caterers", undefined, "OM Caterers", undefined), "MATCH");
    assert.equal(compareVendorIdentity("ABC Technologies", undefined, "OM Caterers", undefined), "MISMATCH");
    assert.equal(compareVendorIdentity(undefined, undefined, "OM Caterers", undefined), "UNVERIFIED");
  });

  it("does not confirm a no-confidence total as extracted", async () => {
    const noConfidence: any = structuredClone(cateringOCR);
    noConfidence.total = 100000;
    const result = await new ExtractionService(new StaticProvider(noConfidence)).extract({
      documentBuffer: Buffer.from("catering invoice"), mimeType: "application/pdf", filename: "bill.pdf",
    });
    assert.equal(result.confidence.total.status, "UNCERTAIN");
  });

  it("evaluates risk using catering invoice fields and flags an unverified PO", async () => {
    const engine = new AnomalyEngine();
    const result = await engine.evaluate({
      invoice: { id: "synthetic-catering", invoiceType: "PO_BASED", invoiceNumber: "OM-1007", vendorId: "vendor-om", vendorName: "OM Caterers", poNumber: "PO-DOES-NOT-EXIST", totalAmount: 100000, lineItems: [{ description: "Catering services", quantity: 1000, amount: 100000 }] },
      vendor: { id: "vendor-om", name: "OM Caterers", isActive: true, isApproved: true },
      purchaseOrder: undefined,
      historicalInvoices: [], recentInvoices: [],
    });
    assert.ok(result.signals.some((signal) => signal.type === "PO_NOT_FOUND"));
    assert.ok(result.risk.score > 0);
  });

  it("creates a new invoice ID for every upload instead of reusing an earlier invoice", () => {
    const makeRecord = (contents: string) => new Invoice({
      organizationId: new Types.ObjectId(), vendorId: new Types.ObjectId(), uploadedBy: new Types.ObjectId(),
      attachmentData: Buffer.from(contents), attachmentSha256: createHash("sha256").update(contents).digest("hex"),
    });
    const first = makeRecord("first upload");
    const second = makeRecord("second upload");
    assert.notEqual(first._id.toString(), second._id.toString());
    assert.notEqual(first.attachmentSha256, second.attachmentSha256);
  });
});
