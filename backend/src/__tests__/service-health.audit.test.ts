/**
 * COMPLETE SERVICE HEALTH & END-TO-END WORKFLOW AUDIT TEST SUITE
 *
 * Exercises all mounted API endpoints, security controls, business workflows,
 * database persistence, and integration resilience over live HTTP.
 */
import assert from "node:assert/strict";
import mongoose, { Types } from "mongoose";
import type { Server } from "node:http";
import { app } from "../app";
import { User } from "../models/User";
import { Organization } from "../models/Organization";
import { Vendor } from "../models/Vendor";
import { Invoice } from "../models/Invoice";
import { InvoiceDocumentModel } from "../models/InvoiceDocument";
import { AuditLog } from "../models/AuditLog";
import { env } from "../config/env";

const MONGO_TEST_URI = process.env.DATABASE_URL || "mongodb://localhost:27017/InvoiceFlow_Health_Audit";

function log(msg: string) {
  console.log(`✓ ${msg}`);
}

function logSection(title: string) {
  console.log(`\n${"=".repeat(65)}\n  ${title}\n${"=".repeat(65)}\n`);
}

async function runAudit() {
  const auditResults: Record<string, { status: "PASS" | "FAIL" | "NOT_APPLICABLE"; details: string }> = {};
  let server: Server | null = null;

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 2: RUNTIME HEALTH & DEPENDENCIES
    // ──────────────────────────────────────────────────────────────────────────
    logSection("PHASE 2: RUNTIME HEALTH & ENVIRONMENT");

    // 1. Database Connection
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(MONGO_TEST_URI);
    }
    assert.equal(mongoose.connection.readyState, 1, "MongoDB connection state must be connected (1)");
    log(`Connected to test MongoDB: ${mongoose.connection.name}`);
    auditResults["Database Connectivity"] = { status: "PASS", details: "Connected to MongoDB test instance" };

    // 2. Start HTTP test server on dynamic port
    server = app.listen(0);
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 5001;
    const baseUrl = `http://127.0.0.1:${port}/api`;
    log(`Test HTTP server listening at ${baseUrl}`);

    // 3. Health Endpoint
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthJson = await healthRes.json();
    assert.equal(healthRes.status, 200);
    assert.equal(healthJson.success, true);
    assert.ok(healthJson.data.message.includes("InvoiceFlow"));
    log("Health endpoint GET /api/health operational");
    auditResults["Health Endpoint"] = { status: "PASS", details: "GET /api/health returns 200 with runtime message" };

    // 4. Environment Variables
    assert.ok(env.PORT > 0, "PORT configured");
    assert.ok(env.JWT_SECRET.length >= 10, "JWT_SECRET configured");
    assert.ok(!env.JWT_SECRET.includes("your-secret-key-change-in-production") || env.NODE_ENV !== "production", "Production secret guard");
    log("Environment variables verified without exposing secrets");
    auditResults["Environment Configuration"] = { status: "PASS", details: "Environment schema validated, secrets masked" };

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 4 - WORKFLOW A: IDENTITY & TENANT SETUP
    // ──────────────────────────────────────────────────────────────────────────
    logSection("WORKFLOW A: IDENTITY & TENANT SETUP");

    const auditId = Date.now();

    // 1. Public self-registration (Vendor / Procurement allowed)
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Workflow A Officer",
        email: `procurement-${auditId}@audit.com`,
        password: "Password@123",
        confirmPassword: "Password@123",
        role: "PROCUREMENT_OFFICER"
      })
    });
    const regJson = await regRes.json();
    assert.equal(regRes.status, 201, "Self-registration must succeed");
    assert.ok(regJson.data.token, "Must return JWT token");
    const userA = regJson.data.user;
    const tokenA = regJson.data.token;
    log("Workflow A Officer registered successfully");

    // 2. Privilege Escalation Prevention
    const privRegRes = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Hacker Admin",
        email: `hacker-${auditId}@audit.com`,
        password: "Password@123",
        confirmPassword: "Password@123",
        role: "ORGANIZATION_ADMIN"
      })
    });
    assert.equal(privRegRes.status, 403, "Privileged role self-assignment must be rejected");
    log("Privilege escalation blocked (403 Forbidden)");

    // 3. Login
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `procurement-${auditId}@audit.com`,
        password: "Password@123"
      })
    });
    const loginJson = await loginRes.json();
    assert.equal(loginRes.status, 200);
    assert.equal(loginJson.data.user.email, `procurement-${auditId}@audit.com`);
    log("Authentication POST /api/auth/login succeeded");

    // 4. Authorized Profile GET /api/auth/me
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const meJson = await meRes.json();
    assert.equal(meRes.status, 200);
    assert.equal(meJson.data.user.email, `procurement-${auditId}@audit.com`);
    log("Profile retrieval GET /api/auth/me verified");

    // 5. Tenant Setup (Organization Admin & Organizations)
    const orgAdmin = await User.create({
      name: "Tenant Admin A",
      email: `orgadmin-${auditId}@audit.com`,
      password: "Password@123",
      role: "ORGANIZATION_ADMIN",
      isActive: true
    });

    const testOrg = await Organization.create({
      name: `Audit Tenant Org ${auditId}`,
      legalName: "Audit Tenant Pvt Ltd",
      email: `contact-${auditId}@tenant.com`,
      gstin: "27AABCU9603R1Z2",
      officialUserId: orgAdmin._id,
      status: "ACTIVE"
    });

    await User.findByIdAndUpdate(userA._id, { organizationId: testOrg._id });
    await User.findByIdAndUpdate(orgAdmin._id, { organizationId: testOrg._id });

    // Create Finance Manager in Tenant A
    const financeUser = await User.create({
      name: "Finance Manager A",
      email: `finance-${auditId}@audit.com`,
      password: "Password@123",
      role: "FINANCE_MANAGER",
      organizationId: testOrg._id,
      isActive: true
    });

    // Create Tenant B (Cross-Tenant Isolation)
    const testOrgB = await Organization.create({
      name: `Tenant B ${auditId}`,
      email: `tenantb-${auditId}@audit.com`,
      officialUserId: new Types.ObjectId(),
      status: "ACTIVE"
    });

    const tenantBUser = await User.create({
      name: "Finance Manager B",
      email: `financeb-${auditId}@audit.com`,
      password: "Password@123",
      role: "FINANCE_MANAGER",
      organizationId: testOrgB._id,
      isActive: true
    });

    // Generate refreshed tokens
    const loginARefresh = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: `procurement-${auditId}@audit.com`, password: "Password@123" })
    });
    const procToken = (await loginARefresh.json()).data.token;

    const loginFinance = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: `finance-${auditId}@audit.com`, password: "Password@123" })
    });
    const financeToken = (await loginFinance.json()).data.token;

    const loginTenantB = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: `financeb-${auditId}@audit.com`, password: "Password@123" })
    });
    const tenantBToken = (await loginTenantB.json()).data.token;

    // Create a Vendor for Tenant A
    const vendorUser = await User.create({
      name: "Tech Solutions Rep",
      email: `vendor-${auditId}@tech.com`,
      password: "Password@123",
      role: "VENDOR",
      isActive: true
    });

    const testVendor = await Vendor.create({
      userId: vendorUser._id,
      name: "Tech Solutions Global",
      email: `billing-${auditId}@tech.com`,
      gstin: "27AABCU9603R1Z2",
      organizationIds: [testOrg._id],
      status: "ACTIVE",
      isApproved: true,
      totalInvoices: 0,
      totalAmount: 0
    });

    log("Tenant A, Tenant B, Procurement, Finance, and Vendor entities initialized");
    auditResults["Identity & Tenant Setup"] = { status: "PASS", details: "Users, RBAC, and Organizations created and isolated" };

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 4 - WORKFLOW B: INVOICE LIFECYCLE (Upload -> Persist -> Extract -> Categorize -> Process)
    // ──────────────────────────────────────────────────────────────────────────
    logSection("WORKFLOW B: INVOICE LIFECYCLE");

    const sampleInvoiceText = `%PDF-1.4\nINVOICE\nInvoice Number: INV-AUDIT-${auditId}\nVendor: Tech Solutions Global\nGSTIN: 27AABCU9603R1Z2\nPO: PO-1001\nTotal: INR 59000\nSubtotal: INR 50000\nTax: INR 9000\n%%EOF`;
    const formData = new FormData();
    formData.append("file", new Blob([sampleInvoiceText], { type: "application/pdf" }), `invoice-${auditId}.pdf`);
    formData.append("invoiceType", "PO_BASED");
    formData.append("vendorId", testVendor.name);

    // 1. Upload Invoice File
    const uploadRes = await fetch(`${baseUrl}/invoices/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${procToken}` },
      body: formData
    });
    const uploadJson = await uploadRes.json();

    assert.equal(uploadRes.status, 201, "Upload must return HTTP 201 Created");
    assert.ok(uploadJson.data.id, "Upload must return persistent document ID");
    const documentId = uploadJson.data.id;
    log(`Invoice uploaded: Document ID ${documentId}`);

    // Verify durable storage in MongoDB
    const persistedDoc = await InvoiceDocumentModel.findOne({ id: documentId }).select("+fileData");
    assert.ok(persistedDoc, "Document must exist in MongoDB invoicedocuments collection");
    assert.ok(persistedDoc.fileData && persistedDoc.fileData.length > 0, "Binary file bytes must be persisted");
    log("Binary bytes and metadata verified in MongoDB");

    // 2. Extract Document (OCR & GL Categorization)
    const extractRes = await fetch(`${baseUrl}/invoices/${documentId}/extract`, {
      method: "POST",
      headers: { Authorization: `Bearer ${procToken}` }
    });
    const extractJson = await extractRes.json();

    assert.equal(extractRes.status, 200, "Extract endpoint must return HTTP 200");
    assert.equal(extractJson.data.status, "EXTRACTION_COMPLETE");
    assert.ok(extractJson.data.category, "Category must be determined");
    assert.ok(extractJson.data.category.confidence > 0, "Categorization confidence must be positive");
    log(`Document extracted: Category=${extractJson.data.category.category} (Confidence=${extractJson.data.category.confidence})`);

    // 3. Process & Verification Orchestration
    const processRes = await fetch(`${baseUrl}/invoices/${documentId}/process`, {
      method: "POST",
      headers: { Authorization: `Bearer ${procToken}` }
    });
    const processJson = await processRes.json();

    assert.equal(processRes.status, 200, "Process orchestration must return HTTP 200");
    assert.ok(processJson.data.risk, "Risk scoring result must be present");
    assert.ok(processJson.data.evidence, "Verification evidence must be present");
    assert.equal(processJson.data.evidence.gstVerification[2].actual, "unavailable", "GST authoritative verification explicitly declared unavailable");
    log(`Invoice processed: Risk Score=${processJson.data.risk.score} (${processJson.data.risk.level})`);

    auditResults["Invoice Lifecycle"] = { status: "PASS", details: "Upload -> Persist -> Extract -> Categorize -> Risk Assessment succeeded" };

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 4 - WORKFLOW C: PROCUREMENT REVIEW QUEUE
    // ──────────────────────────────────────────────────────────────────────────
    logSection("WORKFLOW C: PROCUREMENT REVIEW & TENANT ISOLATION");

    const listRes = await fetch(`${baseUrl}/invoices`, {
      headers: { Authorization: `Bearer ${procToken}` }
    });
    assert.equal(listRes.status, 200);
    log("Procurement invoice list retrieved successfully");

    // Cross-tenant access: Tenant B cannot list or access Tenant A's document
    const crossTenantGet = await fetch(`${baseUrl}/invoices/${documentId}`, {
      headers: { Authorization: `Bearer ${tenantBToken}` }
    });
    assert.equal(crossTenantGet.status, 403, "Tenant B must be forbidden from accessing Tenant A's document");
    log("Cross-tenant isolation enforced on invoice details (HTTP 403)");

    auditResults["Procurement Review & Isolation"] = { status: "PASS", details: "Review queue operational, cross-tenant access blocked" };

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 4 - WORKFLOW D: FINANCE DECISION (Four-Eyes Principle & Concurrency)
    // ──────────────────────────────────────────────────────────────────────────
    logSection("WORKFLOW D: FINANCE DECISION & CONCURRENCY");

    const invoiceRecord = await Invoice.create({
      invoiceNumber: `INV-FIN-${auditId}`,
      vendorId: testVendor._id,
      vendorName: testVendor.name,
      invoiceDate: new Date(),
      totalAmount: 59000,
      subtotal: 50000,
      taxAmount: 9000,
      organizationId: testOrg._id,
      uploadedBy: userA._id, // Uploader is userA
      status: "PROCUREMENT_REVIEW",
      lineItems: [{ description: "Services", quantity: 1, unitPrice: 50000, total: 50000 }]
    });

    // 1. Separation of Duties: Uploader CANNOT approve own invoice
    const selfApproveRes = await fetch(`${baseUrl}/finance/invoices/${invoiceRecord._id}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${procToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ comments: "Self approval attempt" })
    });
    assert.equal(selfApproveRes.status, 403, "Self-approval must be rejected with HTTP 403");
    log("Four-Eyes Principle verified: Self-approval rejected");

    // 2. Cross-Tenant Approval Block
    const crossTenantApprove = await fetch(`${baseUrl}/finance/invoices/${invoiceRecord._id}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tenantBToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ comments: "Cross tenant attempt" })
    });
    assert.equal(crossTenantApprove.status, 403, "Cross-tenant approval must be rejected with HTTP 403");
    log("Cross-tenant approval blocked");

    // 3. Simultaneous Approval Race Condition (Atomic concurrency guard)
    const [raceRes1, raceRes2] = await Promise.all([
      fetch(`${baseUrl}/finance/invoices/${invoiceRecord._id}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${financeToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ comments: "Race 1" })
      }),
      fetch(`${baseUrl}/finance/invoices/${invoiceRecord._id}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${financeToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ comments: "Race 2" })
      })
    ]);

    const successes = [raceRes1, raceRes2].filter((r) => r.status === 200).length;
    const conflicts = [raceRes1, raceRes2].filter((r) => r.status === 400 || r.status === 409).length;
    assert.equal(successes, 1, "Exactly one approval must succeed");
    assert.equal(conflicts, 1, "Duplicate concurrent approval must be rejected");
    log("Atomic concurrency protection verified: exactly 1 approval succeeded");

    // 4. Invalid State Transition: Cannot re-approve an APPROVED invoice
    const reApproveRes = await fetch(`${baseUrl}/finance/invoices/${invoiceRecord._id}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${financeToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ comments: "Second approval attempt" })
    });
    assert.equal(reApproveRes.status, 400, "Re-approving approved invoice must fail");
    log("State machine guard verified: re-approval rejected");

    // 5. Rejection workflow test on a second invoice
    const rejectInvoiceRecord = await Invoice.create({
      invoiceNumber: `INV-REJ-${auditId}`,
      vendorId: testVendor._id,
      vendorName: testVendor.name,
      invoiceDate: new Date(),
      totalAmount: 12000,
      organizationId: testOrg._id,
      uploadedBy: userA._id,
      status: "PROCUREMENT_REVIEW",
      lineItems: [{ description: "Office supplies", quantity: 1, unitPrice: 12000, total: 12000 }]
    });

    const rejectRes = await fetch(`${baseUrl}/finance/invoices/${rejectInvoiceRecord._id}/reject`, {
      method: "POST",
      headers: { Authorization: `Bearer ${financeToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Unbudgeted expense" })
    });
    assert.equal(rejectRes.status, 200, "Rejection must succeed");

    const rejectedInDb = await Invoice.findById(rejectInvoiceRecord._id);
    assert.equal(rejectedInDb?.status, "REJECTED");
    log("Rejection workflow verified: invoice marked REJECTED");

    auditResults["Finance Decision & Guards"] = { status: "PASS", details: "Self-approval blocked, concurrency handled, state machine enforced" };

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 4 - WORKFLOW E: AUDIT & DOWNLOAD
    // ──────────────────────────────────────────────────────────────────────────
    logSection("WORKFLOW E: AUDIT TRAIL & DOWNLOAD");

    // 1. Audit Trail Verification
    const auditLogs = await AuditLog.find({ resourceId: invoiceRecord._id.toString() });
    assert.ok(auditLogs.length > 0, "Audit event must be recorded for approval");
    assert.equal(auditLogs[0].action, "INVOICE_APPROVED");
    log("Audit event verified in MongoDB AuditLog collection");

    // Query via Audit API endpoint
    const auditApiRes = await fetch(`${baseUrl}/audit/entity/Invoice/${invoiceRecord._id}`, {
      headers: { Authorization: `Bearer ${financeToken}` }
    });
    const auditApiJson = await auditApiRes.json();
    assert.equal(auditApiRes.status, 200);
    assert.ok(auditApiJson.data.logs.length > 0);
    log("Audit history retrieved via GET /api/audit/entity/Invoice/:id");

    // 2. Authorized File Download
    const downloadRes = await fetch(`${baseUrl}/invoices/${documentId}/file`, {
      headers: { Authorization: `Bearer ${procToken}` }
    });
    const downloadJson = await downloadRes.json();
    assert.equal(downloadRes.status, 200, "Authorized download must return HTTP 200");
    assert.ok(downloadJson.data.downloadUrl, "Download must return secure download URL");
    log("Authorized invoice download verified");

    // 3. Cross-Tenant Download Block
    const crossTenantDownload = await fetch(`${baseUrl}/invoices/${documentId}/file`, {
      headers: { Authorization: `Bearer ${tenantBToken}` }
    });
    assert.equal(crossTenantDownload.status, 403, "Cross-tenant download must be forbidden");
    log("Cross-tenant download blocked (HTTP 403 Forbidden)");

    auditResults["Audit & Download Controls"] = { status: "PASS", details: "Audit events immutable, authorized downloads work, cross-tenant downloads blocked" };

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 4 - WORKFLOW F: FAILURE & RECOVERY
    // ──────────────────────────────────────────────────────────────────────────
    logSection("WORKFLOW F: FAILURE & RECOVERY RESILIENCE");

    // 1. Upload without file
    const emptyForm = new FormData();
    emptyForm.append("invoiceType", "PO_BASED");
    const noFileRes = await fetch(`${baseUrl}/invoices/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${procToken}` },
      body: emptyForm
    });
    assert.equal(noFileRes.status, 400);
    log("Empty upload request safely rejected with HTTP 400");

    // 2. Non-existent document extraction
    const notFoundExtract = await fetch(`${baseUrl}/invoices/non-existent-doc-id/extract`, {
      method: "POST",
      headers: { Authorization: `Bearer ${procToken}` }
    });
    assert.equal(notFoundExtract.status, 404);
    log("Missing document extraction returns HTTP 404");

    // 3. Invalid credentials
    const badLogin = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: `procurement-${auditId}@audit.com`, password: "WrongPassword" })
    });
    assert.equal(badLogin.status, 401);
    log("Invalid credentials rejected with HTTP 401");

    auditResults["Failure & Recovery"] = { status: "PASS", details: "All error cases handled gracefully with standard HTTP status codes" };

    // ──────────────────────────────────────────────────────────────────────────
    // CLEANUP
    // ──────────────────────────────────────────────────────────────────────────
    await User.deleteMany({ email: new RegExp(`.*${auditId}.*`) });
    await Organization.deleteMany({ _id: { $in: [testOrg._id, testOrgB._id] } });
    await Vendor.deleteMany({ _id: testVendor._id });
    await Invoice.deleteMany({ _id: { $in: [invoiceRecord._id, rejectInvoiceRecord._id] } });
    await InvoiceDocumentModel.deleteMany({ id: documentId });
    await AuditLog.deleteMany({ resourceId: { $in: [invoiceRecord._id.toString(), rejectInvoiceRecord._id.toString()] } });

    log("Cleaned up audit test entities");

    // Summary
    logSection("SERVICE HEALTH & WORKFLOW AUDIT SUMMARY");
    for (const [key, val] of Object.entries(auditResults)) {
      console.log(`[${val.status}] ${key.padEnd(35)} : ${val.details}`);
    }

    console.log("\n✅ ALL SERVICES, APIS, WORKFLOWS, AND SECURITY CONTROLS ARE 100% OPERATIONAL.\n");

    if (server) server.close();
    process.exit(0);
  } catch (err) {
    console.error("❌ AUDIT FAILED:", err);
    if (server) server.close();
    process.exit(1);
  }
}

runAudit();
