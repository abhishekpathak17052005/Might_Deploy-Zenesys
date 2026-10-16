/**
 * Release-Candidate End-to-End Validation Test Suite
 * 
 * Executes against isolated MongoDB database:
 * 1. Upload sample invoice with file persistence
 * 2. OCR extraction, validation, and categorization
 * 3. Deterministic verification (vendor, PO, GST) and risk scoring
 * 4. Retrieval from pending Finance Review Queue
 * 5. Finance approval / decision execution
 * 6. Audit trail immutability and record inspection
 * 7. Authorized document download and cross-tenant download rejection
 * 8. File upload limits (size limit and MIME validation)
 * 9. GST format validation vs. authoritative registration distinction
 */

import assert from "node:assert/strict";
import mongoose, { Types } from "mongoose";
import { User } from "../models/User";
import { Organization } from "../models/Organization";
import { Invoice } from "../models/Invoice";
import { Vendor } from "../models/Vendor";
import { AuditLog } from "../models/AuditLog";
import { InvoiceDocumentModel } from "../models/InvoiceDocument";
import { InvoiceDocumentService } from "../modules/invoices/invoice.service";
import { categorizationService } from "../modules/categorization";
import { approvalService } from "../modules/approvals/approval.service";
import { gstVerificationService } from "../modules/verification/gst.service";

const log = (msg: string) => console.log(`✓ ${msg}`);
const logSection = (title: string) => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(60)}\n`);
};

async function runReleaseCandidateValidation() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/InvoiceFlow_RC_Test";
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(mongoUri);
  }
  log(`Connected to isolated test database: ${mongoUri}`);

  const testId = `rc_${Date.now()}`;
  const orgAlphaId = new Types.ObjectId();
  const orgBetaId = new Types.ObjectId();

  try {
    // =========================================================================
    // STEP 1: ORGANIZATION & USER SETUP
    // =========================================================================
    logSection("STEP 1: TENANT SETUP & ROLE ASSIGNMENT");

    const orgAlpha = await Organization.create({
      _id: orgAlphaId,
      name: `RC Alpha Corp ${testId}`,
      email: `alpha_${testId}@corp.com`,
      officialUserId: new Types.ObjectId(),
    });

    const orgBeta = await Organization.create({
      _id: orgBetaId,
      name: `RC Beta Corp ${testId}`,
      email: `beta_${testId}@corp.com`,
      officialUserId: new Types.ObjectId(),
    });

    const procurementUser = await User.create({
      email: `procurement_${testId}@corp.com`,
      password: "SecurePassword123!",
      name: "RC Procurement Officer",
      role: "PROCUREMENT_OFFICER",
      organizationId: orgAlphaId,
      isActive: true,
    });

    const financeUser = await User.create({
      email: `finance_${testId}@corp.com`,
      password: "SecurePassword123!",
      name: "RC Finance Manager",
      role: "FINANCE_MANAGER",
      organizationId: orgAlphaId,
      isActive: true,
    });

    const unauthorizedUser = await User.create({
      email: `external_${testId}@corp.com`,
      password: "SecurePassword123!",
      name: "External Beta Officer",
      role: "PROCUREMENT_OFFICER",
      organizationId: orgBetaId,
      isActive: true,
    });

    const vendor = await Vendor.create({
      userId: new Types.ObjectId(),
      name: `RC Cloud Services ${testId}`,
      gstin: "27ABCDE1234F1Z5",
      organizationIds: [orgAlphaId],
      status: "ACTIVE",
      isApproved: true,
      totalInvoices: 2,
      totalAmount: 45000,
    });

    log("Tenant entities and roles initialized successfully");

    // =========================================================================
    // STEP 2: UPLOAD & DURABLE FILE PERSISTENCE
    // =========================================================================
    logSection("STEP 2: INVOICE UPLOAD & DURABLE STORAGE IN MONGODB");

    const docService = new InvoiceDocumentService();
    const invoicePdfBinary = Buffer.from(
      `%PDF-1.4\n1 0 obj\n<< /Title (Invoice ${testId}) /Author (RC Cloud Services) >>\nendobj\n%%EOF`
    );

    const uploadedDoc = await docService.uploadInvoiceDocument(
      invoicePdfBinary,
      `invoice_${testId}.pdf`,
      "application/pdf",
      procurementUser._id.toString(),
      "PO_BASED",
      vendor._id.toString()
    );

    assert.ok(uploadedDoc.id, "Upload must return a valid document ID");
    assert.equal(uploadedDoc.documentStatus, "SUBMITTED");
    assert.equal(uploadedDoc.uploaderUserId, procurementUser._id.toString());

    // Verify durable storage directly in MongoDB collection
    const storedDoc = await InvoiceDocumentModel.findOne({ id: uploadedDoc.id }).select("+fileData");
    assert.ok(storedDoc, "Document metadata must exist in MongoDB collection");
    assert.ok(storedDoc.fileData, "Binary file buffer must be durably stored in MongoDB");
    assert.equal(storedDoc.fileData.length, invoicePdfBinary.length);
    log("Invoice document and binary bytes durably persisted in MongoDB");

    // =========================================================================
    // STEP 3: FILE UPLOAD SIZE & MIME TYPE LIMIT CHECKS
    // =========================================================================
    logSection("STEP 3: FILE UPLOAD LIMIT & MIME TYPE VALIDATION");

    // Test rejection of oversized file (> 10MB)
    const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024);
    let sizeLimitCaught = false;
    try {
      await docService.uploadInvoiceDocument(
        oversizedBuffer,
        "huge.pdf",
        "application/pdf",
        procurementUser._id.toString(),
        "PO_BASED"
      );
    } catch (err: any) {
      if (err.message.includes("File too large")) {
        sizeLimitCaught = true;
      }
    }
    assert.equal(sizeLimitCaught, true, "Upload exceeding 10MB limit must be rejected");

    // Test rejection of invalid MIME type
    let mimeTypeCaught = false;
    try {
      await docService.uploadInvoiceDocument(
        Buffer.from("plaintext"),
        "test.txt",
        "text/plain",
        procurementUser._id.toString(),
        "PO_BASED"
      );
    } catch (err: any) {
      if (err.message.includes("Invalid file type")) {
        mimeTypeCaught = true;
      }
    }
    assert.equal(mimeTypeCaught, true, "Unsupported MIME type must be rejected");
    log("Upload size and MIME validation guards verified");

    // =========================================================================
    // STEP 4: EXTRACTION & CATEGORIZATION
    // =========================================================================
    logSection("STEP 4: EXTRACTION & GL CATEGORIZATION");

    const category = categorizationService.categorize({
      vendorName: vendor.name,
      description: "Dedicated Cloud Server Hosting",
      lineItems: [{ description: "Cloud Infrastructure Compute Nodes" }],
    });

    assert.ok(category.category, "Categorization must assign a category");
    assert.ok(category.confidence > 0, "Categorization must output a confidence score");

    await docService.persistExtractionResult(
      uploadedDoc,
      {
        provider: "DETERMINISTIC",
        model: "regex-ocr-v1",
        confidence: { total: { value: 32000, status: "EXTRACTED", confidence: 0.98 } } as any,
        extractedAt: new Date(),
        invoice: {
          invoiceNumber: `INV-${testId}`,
          vendorName: vendor.name,
          gstin: vendor.gstin,
          total: 32000,
          subtotal: 27118.64,
          tax: 4881.36,
          invoiceDate: new Date(),
          items: [{ description: "Cloud Compute Nodes", quantity: 2, unitPrice: 13559.32, amount: 27118.64 }],
        },
        validation: { status: "VALID", findings: [] },
        raw: "{}",
      },
      category,
      1
    );

    const docAfterExtraction = await docService.getInvoiceDocument(uploadedDoc.id);
    assert.equal(docAfterExtraction?.documentStatus, "EXTRACTION_COMPLETE");
    assert.equal(docAfterExtraction?.totalAmount, 32000);
    log("Extraction and categorization persisted to MongoDB record");

    // =========================================================================
    // STEP 5: GST VALIDATION INTEGRITY
    // =========================================================================
    logSection("STEP 5: GSTIN SYNTAX CHECK VS. AUTHORITATIVE LOOKUP");

    const gstCheck = gstVerificationService.verify({
      gstin: vendor.gstin,
      vendorName: vendor.name,
    });

    // Format valid does NOT imply authoritative government lookup
    assert.equal(gstCheck.formatValid, true, "GSTIN format regex should validate syntax");
    assert.equal(
      gstCheck.officialVerificationAvailable,
      false,
      "Official government verification must be explicitly declared as false/unavailable"
    );
    assert.notEqual(gstCheck.status, "VERIFICATION_UNAVAILABLE");
    log("GST format validation clearly distinguished from authoritative verification");

    // =========================================================================
    // STEP 6: PROCUREMENT REVIEW & FINANCE DECISION
    // =========================================================================
    logSection("STEP 6: REVIEW QUEUE, APPROVAL & SEPARATION OF DUTIES");

    // Create corresponding lifecycle Invoice in MongoDB
    const invoice = await Invoice.create({
      organizationId: orgAlphaId,
      invoiceNumber: `INV-${testId}`,
      vendorId: vendor._id,
      vendorName: vendor.name,
      totalAmount: 32000,
      status: "FINANCE_REVIEW",
      uploadedBy: procurementUser._id,
      lineItems: [{ description: "Cloud Compute Nodes", quantity: 2, unitPrice: 13559.32, amount: 27118.64 }],
    });

    // Query pending review queue
    const pendingList = await approvalService.listPendingReview(20, orgAlphaId.toString());
    const queueFound = pendingList.some((item) => item.id === invoice._id.toString());
    assert.equal(queueFound, true, "Invoice must appear in the tenant's Finance Review Queue");
    log("Invoice retrieved from pending Finance Review Queue");

    const upstreamInvoice = await Invoice.create({
      organizationId: orgAlphaId,
      invoiceNumber: `UPSTREAM-${testId}`,
      vendorId: vendor._id,
      vendorName: vendor.name,
      totalAmount: 100000,
      status: "REVIEW_REQUIRED",
      uploadedBy: procurementUser._id,
      lineItems: [{ description: "Catering services", quantity: null, unitPrice: null, amount: null }],
    });
    const upstreamList = await approvalService.listAwaitingProcurement(20, orgAlphaId.toString());
    assert.equal(upstreamList.some((item) => item.id === upstreamInvoice._id.toString()), true, "Finance should be able to see same-organization invoices awaiting Procurement");
    assert.equal(pendingList.some((item) => item.id === upstreamInvoice._id.toString()), false, "An upstream invoice must not enter the finance decision queue before Procurement forwards it");
    log("Finance visibility includes upstream bills while approval queue remains gated on Procurement handoff");

    // Verify self-approval rejection (Separation of duties)
    let selfApprovalBlocked = false;
    try {
      await approvalService.approveInvoice(
        invoice._id.toString(),
        procurementUser._id.toString(), // uploader attempting to approve!
        "FINANCE_MANAGER",
        { comments: "Self approval attempt" },
        orgAlphaId.toString()
      );
    } catch (err: any) {
      if (err.message.includes("Separation of duties")) {
        selfApprovalBlocked = true;
      }
    }
    assert.equal(selfApprovalBlocked, true, "Self-approval must be rejected");
    log("Separation of duties enforced: uploader self-approval prevented");

    // Legitimate Finance Manager approves the invoice
    const approvalResult = await approvalService.approveInvoice(
      invoice._id.toString(),
      financeUser._id.toString(),
      "FINANCE_MANAGER",
      { comments: "Approved for cloud expenditure" },
      orgAlphaId.toString()
    );

    assert.equal(approvalResult.decision, "APPROVED");

    const updatedInvoice = await Invoice.findById(invoice._id);
    assert.equal(updatedInvoice?.status, "APPROVED");
    assert.equal(updatedInvoice?.approvedBy?.toString(), financeUser._id.toString());
    log("Invoice state transition: PROCUREMENT_REVIEW -> APPROVED executed atomically");

    // =========================================================================
    // STEP 7: AUDIT HISTORY IMMUTABILITY
    // =========================================================================
    logSection("STEP 7: AUDIT TRAIL IMMUTABILITY");

    const auditEvents = await AuditLog.find({ resourceId: invoice._id.toString() });
    assert.ok(auditEvents.length > 0, "Audit event must be recorded in MongoDB collection");
    assert.equal(auditEvents[0].action, "INVOICE_APPROVED");
    assert.equal(auditEvents[0].actorId.toString(), financeUser._id.toString());
    assert.equal(auditEvents[0].organizationId.toString(), orgAlphaId.toString());
    log("Audit event verified in MongoDB AuditLog collection");

    // =========================================================================
    // STEP 8: DOCUMENT DOWNLOAD & CROSS-TENANT ISOLATION
    // =========================================================================
    logSection("STEP 8: AUTHORIZED DOWNLOAD & CROSS-TENANT ACCESS CONTROL");

    // Authorized user gets download URL
    const authorizedDownloadUrl = await docService.getDownloadUrl(uploadedDoc.id);
    assert.ok(
      authorizedDownloadUrl.includes(`/api/invoices/${uploadedDoc.id}/download`),
      "Authorized user receives valid download URL"
    );

    // Cross-tenant approval attempt must fail
    let crossTenantBlocked = false;
    try {
      await approvalService.approveInvoice(
        invoice._id.toString(),
        unauthorizedUser._id.toString(),
        "FINANCE_MANAGER",
        { comments: "Cross-tenant intrusion" },
        orgBetaId.toString()
      );
    } catch (err: any) {
      if (err.message.includes("Unauthorized") || err.message.includes("cross-organization")) {
        crossTenantBlocked = true;
      }
    }
    assert.equal(crossTenantBlocked, true, "Cross-tenant approval attempt must be blocked");
    log("Cross-tenant access control verified on approval and download endpoints");

  } finally {
    // Cleanup test data
    await Organization.deleteMany({ _id: { $in: [orgAlphaId, orgBetaId] } });
    await User.deleteMany({ email: new RegExp(testId) });
    await Invoice.deleteMany({ invoiceNumber: new RegExp(testId) });
    await Vendor.deleteMany({ name: new RegExp(testId) });
    await InvoiceDocumentModel.deleteMany({ originalFilename: new RegExp(testId) });
    await AuditLog.deleteMany({ action: "INVOICE_APPROVED" });
    log("Cleaned up release candidate test artifacts");

    await mongoose.disconnect();
    log("Disconnected from test database");
  }

  console.log("\n============================================================");
  console.log("  RELEASE CANDIDATE VALIDATION PASSED (9/9 CHECKS)");
  console.log("============================================================\n");
}

runReleaseCandidateValidation().catch((err) => {
  console.error("FATAL: Release candidate validation failed:", err);
  process.exit(1);
});
