import assert from "node:assert/strict";
import { CategorizationService } from "../../categorization";
import { ExtractionService } from "../../extraction";
import { InMemoryInvoiceProcessingRepository } from "../inMemoryProcessingRepository";
import { InvoiceProcessingService } from "../invoiceProcessing.service";
import { KeywordCategorizationProvider } from "../mockCategorizationProvider";
import { MockEmailProvider } from "../mockEmailProvider";
import { JsonBufferExtractionProvider } from "../mockExtractionProvider";

type TestCase = { name: string; run: () => Promise<void> };

function createService() {
  const emailProvider = new MockEmailProvider();
  const service = new InvoiceProcessingService(
    new InMemoryInvoiceProcessingRepository(),
    new ExtractionService(new JsonBufferExtractionProvider()),
    new CategorizationService(new KeywordCategorizationProvider()),
    emailProvider
  );
  return { service, emailProvider };
}

const tests: TestCase[] = [
  {
    name: "orchestration: clean invoice completes to finance review",
    run: async () => {
      const { service, emailProvider } = createService();
      const result = await service.process("dev-clean-invoice");

      assert.equal(result.invoiceId, "dev-clean-invoice");
      assert.equal(result.status, "FINANCE_REVIEW_PENDING");
      assert.equal(result.extraction.invoice.invoiceNumber, "INV-CLEAN-002");
      assert.equal(result.category.code, "IT_EQUIPMENT");
      assert.equal(result.validation.status, "VALID");
      assert.equal(result.vendorVerification.vendorExists, true);
      assert.equal(result.vendorVerification.activeStatus, true);
      assert.equal(result.vendorVerification.approvedStatus, true);
      assert.ok(result.gstVerification.statuses.includes("VALID_FORMAT"));
      assert.ok(result.gstVerification.statuses.includes("VENDOR_MATCH"));
      assert.equal(result.poVerification.poExists, true);
      assert.equal(result.poVerification.poBelongsToVendor, true);
      assert.equal(result.risk.findings.some((finding) => finding.type === "DUPLICATE_INVOICE"), false);
      assert.equal(result.notification.status, "QUEUED");
      assert.equal(emailProvider.outbox.length, 1);
    }
  },
  {
    name: "orchestration: duplicate invoice feeds existing anomaly engine",
    run: async () => {
      const { service } = createService();
      const result = await service.process("dev-duplicate-invoice");

      assert.ok(result.risk.findings.some((finding) => finding.type === "DUPLICATE_INVOICE"));
      assert.equal(result.risk.decision, "BLOCKED");
      assert.ok(result.evidence.riskSignals.some((signal) => signal.type === "DUPLICATE_INVOICE" && signal.explanation));
    }
  },
  {
    name: "orchestration: PO mismatch is verified and exposed as risk",
    run: async () => {
      const { service } = createService();
      const result = await service.process("dev-po-mismatch");

      assert.equal(result.poVerification.poExists, true);
      assert.equal(result.poVerification.poBelongsToVendor, false);
      assert.ok(result.risk.findings.some((finding) => finding.type === "PO_VENDOR_MISMATCH"));
      assert.ok(result.evidence.poVerification.some((item) => item.check === "po_vendor_match"));
    }
  },
  {
    name: "orchestration: amount mismatch is detected against PO",
    run: async () => {
      const { service } = createService();
      const result = await service.process("dev-amount-mismatch");

      assert.equal(result.poVerification.invoiceAmountWithinPo, false);
      assert.equal(result.poVerification.remainingPoAmountSufficient, false);
      assert.ok(result.risk.findings.some((finding) => finding.type === "AMOUNT_MISMATCH"));
    }
  },
  {
    name: "orchestration: invalid GSTIN records schema validation and GST signal",
    run: async () => {
      const { service } = createService();
      const result = await service.process("dev-invalid-gstin");

      assert.equal(result.validation.status, "INVALID");
      assert.ok(result.gstVerification.statuses.includes("INVALID_FORMAT"));
      assert.ok(result.gstVerification.statuses.includes("VENDOR_MISMATCH"));
      assert.ok(result.risk.findings.some((finding) => finding.type === "INVALID_GSTIN_FORMAT"));
    }
  },
  {
    name: "orchestration: new vendor produces vendor verification findings",
    run: async () => {
      const { service } = createService();
      const result = await service.process("dev-new-vendor");

      assert.equal(result.vendorVerification.vendorExists, false);
      assert.equal(result.vendorVerification.activeStatus, false);
      assert.equal(result.vendorVerification.approvedStatus, false);
      assert.equal(result.category.code, "PROFESSIONAL_SERVICES");
      assert.ok(result.risk.findings.some((finding) => finding.type === "VENDOR_NOT_IN_MASTER"));
    }
  },
  {
    name: "orchestration: split invoice scenario includes related invoices",
    run: async () => {
      const { service } = createService();
      const result = await service.process("dev-split-invoice");

      assert.equal(result.poVerification.previousInvoices.length, 2);
      assert.equal(result.category.code, "MARKETING");
      assert.ok(result.risk.findings.some((finding) => finding.type === "POTENTIAL_SPLIT_INVOICING"));
      assert.ok(result.risk.findings.some((finding) => finding.type === "QUANTITY_MISMATCH"));
    }
  },
  {
    name: "orchestration: response contains all expected top-level keys",
    run: async () => {
      const { service } = createService();
      const result = await service.process("dev-clean-invoice");
      const keys = Object.keys(result).sort();

      assert.deepEqual(keys, [
        "category",
        "evidence",
        "extraction",
        "gstVerification",
        "invoiceId",
        "notification",
        "poVerification",
        "risk",
        "status",
        "validation",
        "vendorVerification"
      ]);
    }
  }
];

async function run() {
  for (const test of tests) {
    try {
      await test.run();
      console.log(`ok - ${test.name}`);
    } catch (error) {
      console.error(`not ok - ${test.name}`);
      console.error(`  ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }
  console.log(`${tests.length} invoice processing orchestration tests passed`);
}

run();
