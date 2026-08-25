import { describe, it, before, after } from "node:test";
import * as assert from "node:assert";
import { connect, disconnect } from "mongoose";
import { User } from "../models/User";
import { Vendor } from "../models/Vendor";
import { Organization } from "../models/Organization";
import { Invoice } from "../models/Invoice";
import { vendorService } from "../services/VendorService";
import { invoiceService } from "../services/InvoiceService";
import { organizationService } from "../services/OrganizationService";
import { Types } from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/invoiceflow-test";

describe("Phase 3: Vendor Registration, Organization Selection, and Invoice Submission", () => {
  let vendorUser: any;
  let vendor: any;
  let organization: any;
  let invoice: any;

  before(async () => {
    // Connect to test database
    await connect(MONGODB_URI);
    console.log("Connected to MongoDB for testing");

    // Clean up collections
    await User.deleteMany({});
    await Vendor.deleteMany({});
    await Organization.deleteMany({});
    await Invoice.deleteMany({});
  });

  after(async () => {
    // Clean up
    await User.deleteMany({});
    await Vendor.deleteMany({});
    await Organization.deleteMany({});
    await Invoice.deleteMany({});
    
    await disconnect();
    console.log("Disconnected from MongoDB");
  });

  describe("Vendor Registration", () => {
    it("should register a new vendor with email, password, name, and gstin", async () => {
      const result = await vendorService.registerVendor({
        email: "vendor1@example.com",
        password: "password123",
        confirmPassword: "password123",
        name: "Tech Vendor Co",
        gstin: "27AABCT1234H1Z0",
      });

      assert.ok(result.user);
      assert.ok(result.vendor);
      assert.ok(result.token);
      assert.equal(result.user.email, "vendor1@example.com");
      assert.equal(result.user.role, "VENDOR");
      assert.equal(result.vendor.name, "Tech Vendor Co");
      assert.equal(result.vendor.status, "ACTIVE");
      assert.equal(result.vendor.isApproved, false);

      vendorUser = result.user;
      vendor = result.vendor;
    });

    it("should not register vendor with mismatched passwords", async () => {
      try {
        await vendorService.registerVendor({
          email: "vendor2@example.com",
          password: "password123",
          confirmPassword: "differentpass",
          name: "Another Vendor",
        });
        assert.fail("Should have thrown error");
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.match((error as Error).message, /Passwords do not match/);
      }
    });

    it("should not register vendor with duplicate email", async () => {
      try {
        await vendorService.registerVendor({
          email: "vendor1@example.com",
          password: "password123",
          confirmPassword: "password123",
          name: "Duplicate Vendor",
        });
        assert.fail("Should have thrown error");
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.match((error as Error).message, /Email already registered/);
      }
    });

    it("should get vendor by userId", async () => {
      const foundVendor = await vendorService.getVendorByUserId(vendorUser._id.toString());
      assert.ok(foundVendor);
      assert.equal(foundVendor!.name, "Tech Vendor Co");
      assert.equal(foundVendor!.userId.toString(), vendorUser._id.toString());
    });
  });

  describe("Organization Setup (for testing)", () => {
    it("should create test organization", async () => {
      const result = await organizationService.createOrganization({
        name: "Acme Corporation",
        legalName: "Acme Corp Ltd",
        gstin: "27AABCT5678H1Z0",
        email: "contact@acme.com",
        officialName: "John Doe",
        officialEmail: "john@acme.com",
        officialPassword: "password123",
        procurementOfficerName: "Jane Smith",
        procurementOfficerEmail: "jane@acme.com",
        procurementOfficerPassword: "password123",
        financeManagerName: "Bob Johnson",
        financeManagerEmail: "bob@acme.com",
        financeManagerPassword: "password123",
      });

      assert.ok(result.organization);
      assert.equal(result.organization.name, "Acme Corporation");
      organization = result.organization;
    });
  });

  describe("Organization Search", () => {
    it("should search organizations by name", async () => {
      const results = await organizationService.searchOrganizations("Acme");
      assert.ok(results.length > 0);
      assert.equal(results[0].name, "Acme Corporation");
    });

    it("should search organizations by legalName", async () => {
      const results = await organizationService.searchOrganizations("Acme Corp");
      assert.ok(results.length > 0);
    });

    it("should search organizations by gstin", async () => {
      const results = await organizationService.searchOrganizations("27AABCT5678H1Z0");
      assert.ok(results.length > 0);
    });

    it("should return empty array for non-matching search", async () => {
      const results = await organizationService.searchOrganizations("NonExistentOrg");
      assert.equal(results.length, 0);
    });
  });

  describe("Vendor Organization Selection", () => {
    it("should add organization to vendor's organizationIds", async () => {
      const updated = await vendorService.addOrganizationToVendor(
        vendor._id.toString(),
        organization._id.toString()
      );

      assert.ok(updated.organizationIds.length > 0);
      assert.ok(
        updated.organizationIds.some(
          (id) => id.toString() === organization._id.toString()
        )
      );
    });

    it("should not add duplicate organization", async () => {
      try {
        await vendorService.addOrganizationToVendor(
          vendor._id.toString(),
          organization._id.toString()
        );
        assert.fail("Should have thrown error");
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.match((error as Error).message, /already associated/);
      }
    });

    it("should return error if organization not found", async () => {
      try {
        await vendorService.addOrganizationToVendor(
          vendor._id.toString(),
          new Types.ObjectId().toString()
        );
        assert.fail("Should have thrown error");
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.match((error as Error).message, /Organization not found/);
      }
    });

    it("should check vendor access to organization", async () => {
      const hasAccess = await vendorService.vendorHasAccessToOrganization(
        vendor._id.toString(),
        organization._id.toString()
      );
      assert.equal(hasAccess, true);
    });

    it("should return false for vendor without organization access", async () => {
      const hasAccess = await vendorService.vendorHasAccessToOrganization(
        vendor._id.toString(),
        new Types.ObjectId().toString()
      );
      assert.equal(hasAccess, false);
    });
  });

  describe("Invoice Submission", () => {
    it("should submit invoice from vendor", async () => {
      const submitted = await invoiceService.submitInvoice(
        vendorUser._id.toString(),
        organization._id.toString(),
        "invoice.pdf"
      );

      assert.ok(submitted);
      assert.equal(submitted.organizationId.toString(), organization._id.toString());
      assert.equal(submitted.vendorId.toString(), vendor._id.toString());
      assert.equal(submitted.uploadedBy.toString(), vendorUser._id.toString());
      assert.equal(submitted.status, "OCR_PROCESSING");
      assert.equal(submitted.attachmentUrl, "invoice.pdf");

      invoice = submitted;
    });

    it("should not allow vendor to submit to organization without access", async () => {
      try {
        // Create another organization without vendor access
        const result = await organizationService.createOrganization({
          name: "Other Corp",
          email: "contact@other.com",
          officialName: "Official",
          officialEmail: "official@other.com",
          officialPassword: "password123",
          procurementOfficerName: "Officer",
          procurementOfficerEmail: "officer@other.com",
          procurementOfficerPassword: "password123",
          financeManagerName: "Finance",
          financeManagerEmail: "finance@other.com",
          financeManagerPassword: "password123",
        });

        await invoiceService.submitInvoice(
          vendorUser._id.toString(),
          result.organization._id.toString(),
          "invoice.pdf"
        );
        assert.fail("Should have thrown error");
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.match((error as Error).message, /does not have access/);
      }
    });

    it("should derive vendorId from JWT user", async () => {
      const founded = await invoiceService.getInvoiceById(
        invoice._id.toString(),
        vendorUser._id.toString()
      );
      assert.ok(founded);
      // vendorId is populated as a Vendor object, extract its _id
      const vendorIdStr = (founded!.vendorId as any)._id.toString();
      assert.equal(vendorIdStr, vendor._id.toString());
    });
  });

  describe("Invoice Listing and Retrieval", () => {
    it("should list vendor's invoices", async () => {
      const result = await invoiceService.listVendorInvoices(vendorUser._id.toString());
      assert.equal(result.total, 1);
      assert.equal(result.invoices.length, 1);
      assert.equal(result.invoices[0]._id.toString(), invoice._id.toString());
    });

    it("should filter invoices by organizationId", async () => {
      const result = await invoiceService.listVendorInvoices(
        vendorUser._id.toString(),
        { organizationId: organization._id.toString() }
      );
      assert.equal(result.total, 1);
    });

    it("should filter invoices by status", async () => {
      const result = await invoiceService.listVendorInvoices(
        vendorUser._id.toString(),
        { status: "OCR_PROCESSING" }
      );
      assert.equal(result.total, 1);
    });

    it("should return empty for different status filter", async () => {
      const result = await invoiceService.listVendorInvoices(
        vendorUser._id.toString(),
        { status: "APPROVED" }
      );
      assert.equal(result.total, 0);
    });

    it("should get invoice by ID with access control", async () => {
      const found = await invoiceService.getInvoiceById(
        invoice._id.toString(),
        vendorUser._id.toString()
      );
      assert.ok(found);
      assert.equal(found!._id.toString(), invoice._id.toString());
    });

    it("should deny access to invoice for unauthorized user", async () => {
      // Create another vendor
      const other = await vendorService.registerVendor({
        email: "vendor2@example.com",
        password: "password123",
        confirmPassword: "password123",
        name: "Other Vendor",
      });

      try {
        await invoiceService.getInvoiceById(
          invoice._id.toString(),
          other.user._id.toString()
        );
        assert.fail("Should have thrown error");
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.match((error as Error).message, /do not have access/);
      }
    });
  });

  describe("Invoice Status Transitions", () => {
    it("should update OCR result on invoice", async () => {
      const updated = await invoiceService.updateOCRResult(
        invoice._id.toString(),
        {
          vendorName: "Tech Vendor Co",
          gstin: "27AABCT1234H1Z0",
          invoiceNumber: "INV-001",
          invoiceDate: new Date("2024-01-15"),
          poNumber: "PO-12345",
          totalAmount: 50000,
          lineItems: [
            {
              description: "Services",
              quantity: 1,
              unitPrice: 50000,
              amount: 50000,
            },
          ],
          extractedAt: new Date(),
        },
        "SERVICES",
        0.95
      );

      assert.ok(updated);
      assert.equal(updated!.status, "OCR_COMPLETED");
      assert.equal(updated!.category, "SERVICES");
      assert.equal(updated!.categoryConfidence, 0.95);
      assert.ok(updated!.ocrResult);
    });

    it("should update risk analysis on invoice", async () => {
      const updated = await invoiceService.updateRiskAnalysis(
        invoice._id.toString(),
        25,
        "LOW",
        []
      );

      assert.ok(updated);
      assert.equal(updated!.status, "PROCUREMENT_REVIEW");
      assert.equal(updated!.riskScore, 25);
      assert.equal(updated!.riskLevel, "LOW");
    });

    it("should approve invoice", async () => {
      const approverId = new Types.ObjectId().toString();
      const approved = await invoiceService.approveInvoice(
        invoice._id.toString(),
        approverId
      );

      assert.ok(approved);
      assert.equal(approved!.status, "APPROVED");
      assert.equal(approved!.approvedBy!.toString(), approverId);
    });
  });

  describe("Organization Invoice Access", () => {
    let orgInvoice: any;

    before(async () => {
      // Create another invoice for org filtering test
      orgInvoice = await invoiceService.submitInvoice(
        vendorUser._id.toString(),
        organization._id.toString(),
        "invoice2.pdf"
      );
    });

    it("should get organization invoices", async () => {
      const result = await invoiceService.getOrganizationInvoices(
        organization._id.toString()
      );
      assert.ok(result.invoices.length >= 2);
      assert.ok(result.total >= 2);
    });

    it("should filter organization invoices by vendor", async () => {
      const result = await invoiceService.getOrganizationInvoices(
        organization._id.toString(),
        { vendorId: vendor._id.toString() }
      );
      assert.ok(result.total >= 2);
    });

    it("should filter organization invoices by status", async () => {
      const result = await invoiceService.getOrganizationInvoices(
        organization._id.toString(),
        { status: "APPROVED" }
      );
      assert.equal(result.total, 1);
    });

    it("should filter organization invoices by risk level", async () => {
      const result = await invoiceService.getOrganizationInvoices(
        organization._id.toString(),
        { riskLevel: "LOW" }
      );
      assert.ok(result.total > 0);
    });
  });

  describe("Invoice Schema and Model", () => {
    it("should have organizationId field", async () => {
      const found = await Invoice.findById(invoice._id);
      assert.ok(found);
      assert.ok(found!.organizationId);
    });

    it("should have OCR result fields", async () => {
      const found = await Invoice.findById(invoice._id);
      assert.ok(found);
      assert.ok(found!.ocrResult);
      assert.ok(found!.category);
      assert.ok(found!.categoryConfidence !== undefined);
    });

    it("should have risk analysis fields", async () => {
      const found = await Invoice.findById(invoice._id);
      assert.ok(found);
      assert.ok(found!.riskScore !== undefined);
      assert.ok(found!.riskLevel);
      assert.ok(Array.isArray(found!.anomalies));
    });

    it("should have correct status enum", async () => {
      const found = await Invoice.findById(invoice._id);
      assert.ok(found);
      const validStatuses = [
        "SUBMITTED",
        "OCR_PROCESSING",
        "OCR_COMPLETED",
        "PROCUREMENT_REVIEW",
        "APPROVED",
        "REJECTED",
        "ON_HOLD",
      ];
      assert.ok(validStatuses.includes(found!.status));
    });
  });
});
