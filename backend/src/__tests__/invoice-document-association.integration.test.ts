import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, describe, it } from "node:test";
import mongoose, { Types } from "mongoose";
import { Invoice } from "../models/Invoice";
import { InvoiceDocumentModel } from "../models/InvoiceDocument";
import { AuditLog } from "../models/AuditLog";
import { User } from "../models/User";
import { Vendor } from "../models/Vendor";
import { ExtractionService } from "../modules/extraction/extraction.service";
import type { InvoiceExtractionProvider } from "../modules/extraction/extraction.types";
import { invoiceService } from "../services/InvoiceService";

const mongoUri = process.env.INVOICEFLOW_TEST_DATABASE_URL;
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const vendorUserId = new Types.ObjectId();
const officerId = new Types.ObjectId();
const organizationId = new Types.ObjectId();
const invoiceIds: string[] = [];
let vendor: any;
let databaseReady = false;

const cateringOCR = {
  invoice_number: { value: "OM-REG-1", confidence: 0.98 },
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
  constructor(private readonly data: unknown) {}
  async extractInvoice(): Promise<unknown> { return this.data; }
}

describe("invoice document association integration", () => {
  before(async () => {
    if (!mongoUri) return;
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    databaseReady = true;
    await User.create([
      { _id: vendorUserId, email: `vendor-${suffix}@example.test`, password: "test-password", name: "OM Caterers", role: "VENDOR" },
      { _id: officerId, email: `procurement-${suffix}@example.test`, password: "test-password", name: "Review Officer", role: "PROCUREMENT_OFFICER", organizationId },
    ]);
    vendor = await Vendor.create({ userId: vendorUserId, name: "OM Caterers", organizationIds: [organizationId], status: "ACTIVE", isApproved: true });
  });

  after(async () => {
    if (!databaseReady) return;
    if (invoiceIds.length) {
      await Invoice.deleteMany({ _id: { $in: invoiceIds } });
      await InvoiceDocumentModel.deleteMany({ id: { $in: invoiceIds } });
      await AuditLog.deleteMany({ resourceId: { $in: invoiceIds } });
    }
    await Vendor.deleteOne({ _id: vendor?._id });
    await User.deleteMany({ _id: { $in: [vendorUserId, officerId] } });
    await mongoose.disconnect();
  });

  it("persists the exact uploaded bytes, OCR result, risk evidence, API record ID, and one-to-one document association", async (context) => {
    if (!databaseReady) return context.skip("Set INVOICEFLOW_TEST_DATABASE_URL to an isolated MongoDB test database.");
    const original = Buffer.from(`Synthetic OM Caterers bill ${suffix}: catering food services for 1,000 persons, total INR 100000`);
    const expectedHash = createHash("sha256").update(original).digest("hex");
    const submitted = await invoiceService.submitInvoice(vendorUserId.toString(), organizationId.toString(), "om-caterers.pdf", original, "application/pdf");
    invoiceIds.push(submitted._id.toString());
    const extracted = await new ExtractionService(new StaticProvider(cateringOCR)).extract({ documentBuffer: original, mimeType: "application/pdf", filename: "om-caterers.pdf" });
    const saved = await invoiceService.saveVendorOCRResult(submitted._id.toString(), extracted);
    const persisted = await Invoice.findById(submitted._id).select("+attachmentData");
    const reviewResponse = await invoiceService.getProcurementReview(submitted._id.toString(), officerId.toString());

    assert.ok(persisted);
    assert.equal(createHash("sha256").update(persisted!.attachmentData!).digest("hex"), expectedHash);
    assert.equal(persisted!.attachmentSha256, expectedHash);
    assert.equal(persisted!.invoiceNumber, "OM-REG-1");
    assert.equal(persisted!.totalAmount, 100000);
    assert.match(persisted!.description || "", /catering|food services/i);
    assert.doesNotMatch(persisted!.description || "", /software/i);
    assert.equal(persisted!.vendorName, "OM Caterers");
    assert.equal(persisted!.ocrResult?.vendorName, "OM Caterers");
    assert.equal(persisted!.vendorMatchStatus, "MATCH");
    assert.equal(persisted!.riskEvaluationStatus, "EVALUATED");
    assert.equal(String(reviewResponse.invoice._id), submitted._id.toString());
    assert.equal(String((reviewResponse.invoice.vendorId as any)._id), vendor._id.toString());
    assert.equal(reviewResponse.invoice.totalAmount, persisted!.totalAmount);
    assert.equal(saved._id.toString(), submitted._id.toString());
    assert.equal(await InvoiceDocumentModel.countDocuments({ id: submitted._id.toString() }), 0, "file is embedded and hash-linked to this invoice; no separately reusable document is associated");
  });

  it("isolates a second upload and blocks unverified vendor/PO evidence without explicit review acknowledgement", async (context) => {
    if (!databaseReady) return context.skip("Set INVOICEFLOW_TEST_DATABASE_URL to an isolated MongoDB test database.");
    const firstBytes = Buffer.from(`first upload ${suffix}`);
    const first = await invoiceService.submitInvoice(vendorUserId.toString(), organizationId.toString(), "first.pdf", firstBytes, "application/pdf");
    invoiceIds.push(first._id.toString());
    const secondBytes = Buffer.from(`second upload ${suffix}`);
    const second = await invoiceService.submitInvoice(vendorUserId.toString(), organizationId.toString(), "second.pdf", secondBytes, "application/pdf");
    invoiceIds.push(second._id.toString());
    assert.notEqual(first._id.toString(), second._id.toString());
    assert.notEqual(first.attachmentSha256, second.attachmentSha256);

    const mismatch = structuredClone(cateringOCR) as any;
    mismatch.invoice_number = { value: "OM-REG-2", confidence: 0.98 };
    mismatch.vendor_name = { value: "Unrelated Software Vendor", confidence: 0.98 };
    mismatch.po_number = { value: "PO-UNKNOWN", confidence: 0.98 };
    const extraction = await new ExtractionService(new StaticProvider(mismatch)).extract({ documentBuffer: secondBytes, mimeType: "application/pdf", filename: "second.pdf" });
    const saved = await invoiceService.saveVendorOCRResult(second._id.toString(), extraction);
    assert.equal(saved.vendorMatchStatus, "MISMATCH");
    assert.equal(saved.poMatchStatus, "UNVERIFIED");
    assert.ok(saved.riskScore! > 0);
    await assert.rejects(invoiceService.verifyForFinance(second._id.toString(), officerId.toString(), organizationId.toString()), /explicitly acknowledge/);
    const forwarded = await invoiceService.verifyForFinance(second._id.toString(), officerId.toString(), organizationId.toString(), true);
    assert.equal(forwarded.status, "FINANCE_REVIEW");
    assert.equal(forwarded.procurementExceptionAcknowledged, true);
  });

  it("persists extraction failure as review required without fabricated amount or risk", async (context) => {
    if (!databaseReady) return context.skip("Set INVOICEFLOW_TEST_DATABASE_URL to an isolated MongoDB test database.");
    const failed = await invoiceService.submitInvoice(vendorUserId.toString(), organizationId.toString(), "unreadable.pdf", Buffer.from("unreadable"), "application/pdf");
    invoiceIds.push(failed._id.toString());
    const saved = await invoiceService.markVendorExtractionFailed(failed._id.toString(), "OCR provider unavailable");
    assert.equal(saved.status, "REVIEW_REQUIRED");
    assert.equal(saved.extractionStatus, "FAILED");
    assert.equal(saved.totalAmount, undefined);
    assert.equal(saved.invoiceNumber, undefined);
    assert.equal(saved.riskEvaluationStatus, "NOT_EVALUATED");
    assert.equal(saved.riskScore, undefined);
  });
});
import "dotenv/config";
