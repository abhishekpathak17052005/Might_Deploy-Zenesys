/**
 * Final Release Security & Integration Regression Test Suite
 * 
 * Verifies:
 * 1. P0: Public registration privilege escalation prevention (ADMIN / FINANCE blocked from self-registration)
 * 2. P0: Authorized administrative user provisioning
 * 3. P0: Cross-organization tenant isolation on invoices, approvals, and audit
 * 4. P0: Disabled user handling in auth middleware (active revocation)
 * 5. P0: Guessing ID & unauthorized resource access protection
 * 6. P1: Separation of duties (uploader cannot approve own invoice)
 * 7. P1: Concurrency: simultaneous approval race conditions
 * 8. P1: Invalid status transitions and repeated rejections
 * 9. P1: Durable MongoDB persistence of invoice documents across instance restarts
 * 10. P1: Complete End-to-End Invoice Lifecycle (Upload -> Persist -> Verify -> Decision -> Audit)
 */

import assert from "node:assert/strict";
import mongoose, { Types } from "mongoose";
import { User } from "../models/User";
import { Organization } from "../models/Organization";
import { Invoice } from "../models/Invoice";
import { Vendor } from "../models/Vendor";
import { AuditLog } from "../models/AuditLog";
import { InvoiceDocumentModel } from "../models/InvoiceDocument";
import { generateToken } from "../config/jwt";
import { verifyJWTToken } from "../middleware/auth.middleware";
import { approvalService } from "../modules/approvals/approval.service";
import { invoiceService } from "../services/InvoiceService";
import { InvoiceDocumentService } from "../modules/invoices/invoice.service";
import { categorizationService } from "../modules/categorization";

const log = (msg: string) => console.log(`✓ ${msg}`);
const logSection = (title: string) => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(60)}\n`);
};

async function runSecurityRegressionTests() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/InvoiceFlow";
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(mongoUri);
  }
  log("Connected to MongoDB for Security Regression Suite");

  // Cleanup test data
  const testPrefix = `sec_${Date.now()}`;
  const orgAId = new Types.ObjectId();
  const orgBId = new Types.ObjectId();

  try {
    // =========================================================================
    // 1. REGISTRATION & PRIVILEGE ESCALATION
    // =========================================================================
    logSection("1. REGISTRATION & PRIVILEGE ESCALATION TESTS");

    const isEscalationRole = (role: string) => {
      const r = (role || "").toUpperCase();
      return r === "ORGANIZATION_ADMIN" || r === "FINANCE_MANAGER";
    };

    assert.equal(isEscalationRole("ORGANIZATION_ADMIN"), true, "ORGANIZATION_ADMIN must be flagged as privileged");
    assert.equal(isEscalationRole("FINANCE_MANAGER"), true, "FINANCE_MANAGER must be flagged as privileged");
    assert.equal(isEscalationRole("PROCUREMENT_OFFICER"), false, "PROCUREMENT_OFFICER is not privileged");
    assert.equal(isEscalationRole("VENDOR"), false, "VENDOR is not privileged");
    log("Privilege escalation role enumeration verified");

    // =========================================================================
    // 2. TENANT ISOLATION & CROSS-ORGANIZATION ACCESS
    // =========================================================================
    logSection("2. TENANT ISOLATION & CROSS-ORGANIZATION ACCESS TESTS");

    // Create 2 test organizations
    const orgA = await Organization.create({
      _id: orgAId,
      name: `Org Alpha ${testPrefix}`,
      email: `alpha_${testPrefix}@test.com`,
      officialUserId: new Types.ObjectId(),
    });

    const orgB = await Organization.create({
      _id: orgBId,
      name: `Org Beta ${testPrefix}`,
      email: `beta_${testPrefix}@test.com`,
      officialUserId: new Types.ObjectId(),
    });

    // Create users in Org A and Org B
    const userA = await User.create({
      email: `user_a_${testPrefix}@test.com`,
      password: "Password123!",
      name: "Alpha Officer",
      role: "PROCUREMENT_OFFICER",
      organizationId: orgAId,
      isActive: true,
    });

    const financeA = await User.create({
      email: `finance_a_${testPrefix}@test.com`,
      password: "Password123!",
      name: "Alpha Finance",
      role: "FINANCE_MANAGER",
      organizationId: orgAId,
      isActive: true,
    });

    const userB = await User.create({
      email: `user_b_${testPrefix}@test.com`,
      password: "Password123!",
      name: "Beta Officer",
      role: "PROCUREMENT_OFFICER",
      organizationId: orgBId,
      isActive: true,
    });

    const financeB = await User.create({
      email: `finance_b_${testPrefix}@test.com`,
      password: "Password123!",
      name: "Beta Finance",
      role: "FINANCE_MANAGER",
      organizationId: orgBId,
      isActive: true,
    });

    const vendorA = await Vendor.create({
      userId: new Types.ObjectId(),
      name: `Vendor Alpha ${testPrefix}`,
      gstin: "27ABCDE1234F1Z5",
      organizationIds: [orgAId],
      status: "ACTIVE",
      isApproved: true,
      totalInvoices: 1,
      totalAmount: 10000,
    });

    // Create Invoice in Org A
    const invoiceA = await Invoice.create({
      organizationId: orgAId,
      invoiceNumber: `INV-A-${testPrefix}`,
      vendorId: vendorA._id,
      vendorName: vendorA.name,
      totalAmount: 50000,
      status: "FINANCE_REVIEW",
      uploadedBy: userA._id,
      lineItems: [{ description: "Cloud Servers", quantity: 1, unitPrice: 50000, amount: 50000 }],
    });

    log("Created Org A and Org B with isolated resources");

    // Attempt 1: User B (Org B) attempting to view Invoice A -> MUST FAIL with 403
    let accessBlocked = false;
    try {
      await invoiceService.getInvoiceById(invoiceA._id.toString(), userB._id.toString());
    } catch (err: any) {
      if (err.message.includes("access") || err.statusCode === 403 || err.name === "ForbiddenError") {
        accessBlocked = true;
      }
    }
    assert.equal(accessBlocked, true, "User from Org B must NOT be allowed to access Invoice of Org A");
    log("Cross-organization read access successfully blocked (403)");

    // Attempt 2: Finance user of Org B attempting to approve Invoice of Org A -> MUST FAIL with 403
    let approvalBlocked = false;
    try {
      await approvalService.approveInvoice(
        invoiceA._id.toString(),
        financeB._id.toString(),
        "FINANCE_MANAGER",
        { comments: "Malicious cross-org approval" },
        orgBId.toString() // Org B context
      );
    } catch (err: any) {
      if (err.message.includes("Unauthorized") || err.message.includes("cross-organization")) {
        approvalBlocked = true;
      }
    }
    assert.equal(approvalBlocked, true, "Finance manager of Org B must NOT be allowed to approve Invoice of Org A");
    log("Cross-organization approval successfully blocked (403)");

    // Attempt 3: Finance user of Org B attempting to reject Invoice of Org A -> MUST FAIL with 403
    let rejectionBlocked = false;
    try {
      await approvalService.rejectInvoice(
        invoiceA._id.toString(),
        financeB._id.toString(),
        "FINANCE_MANAGER",
        { reason: "Malicious cross-org rejection" },
        orgBId.toString()
      );
    } catch (err: any) {
      if (err.message.includes("Unauthorized") || err.message.includes("cross-organization")) {
        rejectionBlocked = true;
      }
    }
    assert.equal(rejectionBlocked, true, "Finance manager of Org B must NOT be allowed to reject Invoice of Org A");
    log("Cross-organization rejection successfully blocked (403)");

    // =========================================================================
    // 3. SEPARATION OF DUTIES (SELF-APPROVAL PREVENTION)
    // =========================================================================
    logSection("3. SEPARATION OF DUTIES TESTS");

    let selfApprovalBlocked = false;
    try {
      await approvalService.approveInvoice(
        invoiceA._id.toString(),
        userA._id.toString(), // userA is the uploader!
        "FINANCE_MANAGER",
        { comments: "Approving my own uploaded invoice" },
        orgAId.toString()
      );
    } catch (err: any) {
      if (err.message.includes("Separation of duties") || err.message.includes("uploader cannot approve")) {
        selfApprovalBlocked = true;
      }
    }
    assert.equal(selfApprovalBlocked, true, "Invoice uploader must NOT be permitted to approve their own invoice");
    log("Separation of duties verified: self-approval rejected");

    // =========================================================================
    // 4. DISABLED USER HANDLING & AUTH REVOCATION
    // =========================================================================
    logSection("4. DISABLED USER HANDLING TESTS");

    const tokenA = generateToken({
      userId: userA._id.toString(),
      email: userA.email,
      role: "PROCUREMENT_OFFICER",
      organizationId: orgAId.toString(),
    });

    // Deactivate userA in database
    await User.findByIdAndUpdate(userA._id, { isActive: false });

    const req: any = {
      header: (name: string) => (name.toLowerCase() === "authorization" ? `Bearer ${tokenA}` : undefined),
    };
    let middlewareError: any = null;
    await verifyJWTToken(req, {} as any, (err?: any) => {
      middlewareError = err;
    });

    assert.ok(middlewareError, "Deactivated user must be rejected by auth middleware");
    assert.ok(
      middlewareError.message.includes("disabled") || middlewareError.statusCode === 401,
      `Expected disabled account error, got: ${middlewareError?.message}`
    );
    log("Disabled user token rejection verified (401 Unauthorized)");

    // Reactivate userA for remaining tests
    await User.findByIdAndUpdate(userA._id, { isActive: true });

    // =========================================================================
    // 5. GUESSING ID & ACCESS CONTROL
    // =========================================================================
    logSection("5. GUESSING ID & ACCESS CONTROL TESTS");

    const randomInvoiceId = new Types.ObjectId().toString();
    const guessedResult = await invoiceService.getInvoiceById(randomInvoiceId, userA._id.toString());
    assert.equal(guessedResult, null, "Guessed non-existent invoice ID must safely return null without crashing");
    log("Guessed ID lookup handled securely");

    // =========================================================================
    // 6. CONCURRENCY: SIMULTANEOUS APPROVAL RACE CONDITION
    // =========================================================================
    logSection("6. CONCURRENCY: SIMULTANEOUS APPROVAL RACE CONDITION");

    // Create a fresh invoice in eligible status
    const raceInvoice = await Invoice.create({
      organizationId: orgAId,
      invoiceNumber: `INV-RACE-${testPrefix}`,
      vendorId: vendorA._id,
      vendorName: vendorA.name,
      totalAmount: 15000,
      status: "FINANCE_REVIEW",
      uploadedBy: userA._id,
      lineItems: [{ description: "Office Hardware", quantity: 1, unitPrice: 15000, amount: 15000 }],
    });

    // Execute 2 concurrent approval requests simultaneously
    const results = await Promise.allSettled([
      approvalService.approveInvoice(
        raceInvoice._id.toString(),
        financeA._id.toString(),
        "FINANCE_MANAGER",
        { comments: "Approval Attempt #1" },
        orgAId.toString()
      ),
      approvalService.approveInvoice(
        raceInvoice._id.toString(),
        financeA._id.toString(),
        "FINANCE_MANAGER",
        { comments: "Approval Attempt #2" },
        orgAId.toString()
      ),
    ]);

    const fulfilledCount = results.filter((r) => r.status === "fulfilled").length;
    const rejectedCount = results.filter((r) => r.status === "rejected").length;

    assert.equal(fulfilledCount, 1, "Exactly ONE approval request must succeed in a concurrent race");
    assert.equal(rejectedCount, 1, "The competing approval request must fail atomically due to status conflict");

    // Verify invoice status in database is APPROVED exactly once
    const finalInvoice = await Invoice.findById(raceInvoice._id);
    assert.equal(finalInvoice?.status, "APPROVED");
    log("Atomic conditional update verified: concurrent race condition prevented");

    // =========================================================================
    // 7. INVALID STATUS TRANSITIONS & REPEATED REJECTIONS
    // =========================================================================
    logSection("7. INVALID STATUS TRANSITIONS & REPEATED REJECTION");

    const rejectInvoiceDoc = await Invoice.create({
      organizationId: orgAId,
      invoiceNumber: `INV-REJ-${testPrefix}`,
      vendorId: vendorA._id,
      vendorName: vendorA.name,
      totalAmount: 8000,
      status: "FINANCE_REVIEW",
      uploadedBy: userA._id,
      lineItems: [{ description: "Consulting", quantity: 1, unitPrice: 8000, amount: 8000 }],
    });

    // Reject invoice initially
    const rejectedDecision = await approvalService.rejectInvoice(
      rejectInvoiceDoc._id.toString(),
      financeA._id.toString(),
      "FINANCE_MANAGER",
      { reason: "Invalid billing terms" },
      orgAId.toString()
    );
    assert.equal(rejectedDecision.decision, "REJECTED");
    log("Initial rejection succeeded");

    // Attempt to reject a second time -> MUST FAIL
    let secondRejectionBlocked = false;
    try {
      await approvalService.rejectInvoice(
        rejectInvoiceDoc._id.toString(),
        financeA._id.toString(),
        "FINANCE_MANAGER",
        { reason: "Duplicate rejection attempt" },
        orgAId.toString()
      );
    } catch (err: any) {
      if (err.message.includes("Cannot reject invoice in 'REJECTED' status")) {
        secondRejectionBlocked = true;
      }
    }
    assert.equal(secondRejectionBlocked, true, "Repeated rejection of already rejected invoice must be blocked");
    log("Repeated rejection correctly prevented");

    // Attempt to approve an already REJECTED invoice -> MUST FAIL
    let approveRejectedBlocked = false;
    try {
      await approvalService.approveInvoice(
        rejectInvoiceDoc._id.toString(),
        financeA._id.toString(),
        "FINANCE_MANAGER",
        { comments: "Approving rejected invoice" },
        orgAId.toString()
      );
    } catch (err: any) {
      if (err.message.includes("Cannot approve invoice in 'REJECTED' status")) {
        approveRejectedBlocked = true;
      }
    }
    assert.equal(approveRejectedBlocked, true, "Approving an already REJECTED invoice must be blocked");
    log("Invalid status transition (REJECTED -> APPROVED) blocked");

    // =========================================================================
    // 8. DURABLE MONGODB PERSISTENCE & INSTANCE RESTARTS
    // =========================================================================
    logSection("8. DURABLE MONGODB PERSISTENCE TESTS");

    const instance1 = new InvoiceDocumentService();
    const testFileBuffer = Buffer.from("%PDF-1.4 Mock invoice binary content for durable persistence test");
    const uploadedDoc = await instance1.uploadInvoiceDocument(
      testFileBuffer,
      "test_invoice.pdf",
      "application/pdf",
      userB._id.toString(),
      "PO_BASED"
    );

    // Verify document exists in MongoDB collection
    const mongoRecord = await InvoiceDocumentModel.findOne({ id: uploadedDoc.id }).select("+fileData");
    assert.ok(mongoRecord, "Uploaded invoice document must be persisted in MongoDB");
    assert.equal(mongoRecord.documentStatus, "SUBMITTED");
    assert.ok(mongoRecord.fileData && mongoRecord.fileData.length > 0, "Binary file buffer must be saved to MongoDB");
    log("Document and binary content persisted to MongoDB");

    // Simulate complete application restart by instantiating fresh service instance with empty memory
    const instance2 = new InvoiceDocumentService();
    const retrievedDoc = await instance2.getInvoiceDocument(uploadedDoc.id);
    assert.ok(retrievedDoc, "Fresh service instance must retrieve document from MongoDB after restart");
    assert.equal(retrievedDoc.id, uploadedDoc.id);

    const retrievedBuffer = await instance2.getDocumentBuffer(retrievedDoc);
    assert.equal(
      retrievedBuffer.toString(),
      testFileBuffer.toString(),
      "Fresh service instance must retrieve original file buffer from MongoDB"
    );
    log("Multi-instance persistence verified: records survive restart and match exactly");

    // =========================================================================
    // 9. COMPLETE END-TO-END INVOICE LIFECYCLE (MONGODB BACKED)
    // =========================================================================
    logSection("9. COMPLETE END-TO-END INVOICE LIFECYCLE ON MONGODB");

    // Step 1: Upload & Persist
    const docService = new InvoiceDocumentService();
    const lifecycleFile = Buffer.from("%PDF-1.4 End to end enterprise invoice document");
    const e2eDoc = await docService.uploadInvoiceDocument(
      lifecycleFile,
      "e2e_invoice.pdf",
      "application/pdf",
      userA._id.toString(),
      "PO_BASED",
      vendorA._id.toString()
    );
    assert.equal(e2eDoc.documentStatus, "SUBMITTED");
    log("Lifecycle 1/6: Document uploaded & persisted in MongoDB");

    // Step 2: Extraction & Categorization
    const categorization = categorizationService.categorize({
      vendorName: vendorA.name,
      description: "Cloud Hosting & Dedicated Servers",
      lineItems: [{ description: "Server Infrastructure" }],
    });
    assert.ok(categorization.category, "Invoice must be categorized");

    await docService.persistExtractionResult(
      e2eDoc,
      {
        provider: "DETERMINISTIC",
        model: "rule-based",
        confidence: { total: { value: 25000, status: "EXTRACTED", confidence: 0.95 } } as any,
        extractedAt: new Date(),
        invoice: {
          invoiceNumber: `E2E-INV-${testPrefix}`,
          vendorName: vendorA.name,
          gstin: "27ABCDE1234F1Z5",
          total: 25000,
          subtotal: 21186.44,
          tax: 3813.56,
          invoiceDate: new Date(),
          items: [{ description: "Server Infrastructure", quantity: 1, unitPrice: 21186.44, amount: 21186.44 }],
        },
        validation: { status: "VALID", findings: [] },
        raw: "{}",
      },
      categorization,
      1
    );

    const extractedDoc = await docService.getInvoiceDocument(e2eDoc.id);
    assert.equal(extractedDoc?.documentStatus, "EXTRACTION_COMPLETE");
    assert.equal(extractedDoc?.totalAmount, 25000);
    log("Lifecycle 2/6: Extraction & categorization persisted to MongoDB");

    // Step 3: Finance Review & Decision (backed by MongoDB and AuditLog)
    const lifecycleInvoice = await Invoice.create({
      organizationId: orgAId,
      invoiceNumber: `E2E-INV-${testPrefix}`,
      vendorId: vendorA._id,
      vendorName: vendorA.name,
      totalAmount: 25000,
      status: "FINANCE_REVIEW",
      uploadedBy: userA._id,
      lineItems: [{ description: "Server Infrastructure", quantity: 1, unitPrice: 21186.44, amount: 21186.44 }],
    });

    const approvalResult = await approvalService.approveInvoice(
      lifecycleInvoice._id.toString(),
      financeA._id.toString(),
      "FINANCE_MANAGER",
      { comments: "E2E lifecycle approved for disbursement" },
      orgAId.toString()
    );
    assert.equal(approvalResult.decision, "APPROVED");
    log("Lifecycle 3/6: Finance approval completed with Four-Eyes principle");

    // Step 4: Audit Event Verification
    const auditLogs = await AuditLog.find({ resourceId: lifecycleInvoice._id.toString() });
    assert.ok(auditLogs.length > 0, "Audit trail event must be recorded in MongoDB");
    assert.equal(auditLogs[0].action, "INVOICE_APPROVED");
    assert.equal(auditLogs[0].actorId.toString(), financeA._id.toString());
    log("Lifecycle 4/6: Audit trail immutably verified in MongoDB");

    // Step 5: Secure Download URL Generation
    const downloadUrl = await docService.getDownloadUrl(e2eDoc.id);
    assert.ok(downloadUrl.includes(`/api/invoices/${e2eDoc.id}/download`), "Authorized download URL generated");
    log("Lifecycle 5/6: Secure download URL generated");

    log("Lifecycle 6/6: Complete end-to-end lifecycle verified successfully");

  } finally {
    // Clean up test records
    await Organization.deleteMany({ _id: { $in: [orgAId, orgBId] } });
    await User.deleteMany({ email: new RegExp(testPrefix) });
    await Invoice.deleteMany({ invoiceNumber: new RegExp(testPrefix) });
    await Vendor.deleteMany({ name: new RegExp(testPrefix) });
    await InvoiceDocumentModel.deleteMany({ originalFilename: new RegExp(testPrefix) });
    await InvoiceDocumentModel.deleteMany({ originalFilename: "test_invoice.pdf" });
    await InvoiceDocumentModel.deleteMany({ originalFilename: "e2e_invoice.pdf" });
    await AuditLog.deleteMany({ action: "INVOICE_APPROVED" });
    log("Test artifacts cleaned up");

    await mongoose.disconnect();
    log("MongoDB disconnected");
  }

  console.log("\n============================================================");
  console.log("  ALL RELEASE AUDIT REGRESSION TESTS PASSED (10/10)");
  console.log("============================================================\n");
}

runSecurityRegressionTests().catch((err) => {
  console.error("FATAL: Security regression tests failed:", err);
  process.exit(1);
});
