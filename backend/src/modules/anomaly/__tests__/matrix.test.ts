import assert from "node:assert/strict";
import { AnomalyEngine } from "../anomaly.engine";
import { DuplicateInvoiceRule } from "../rules/duplicateInvoice.rule";
import { mergeAnomalyConfig } from "../anomaly.config";
import type { AnomalyContext } from "../anomaly.types";
import { ValidationLayer } from "../validation.layer";

type TestCase = { name: string; run: () => Promise<void> | void };

const baseContext = (overrides: Partial<AnomalyContext> = {}): AnomalyContext => ({
  invoice: {
    id: "INV-1",
    invoiceNumber: "INV-001",
    invoiceType: "PO_BASED",
    vendorId: "V1",
    vendorName: "ABC Technologies",
    poId: "PO1",
    totalAmount: 100,
    invoiceDate: "2026-08-20",
    gstin: "27ABCDE1234F1Z5",
    lineItems: []
  },
  vendor: { id: "V1", name: "ABC Technologies", gstin: "27ABCDE1234F1Z5", isActive: true },
  purchaseOrder: {
    id: "PO1",
    poNumber: "PO-1",
    vendorId: "V1",
    totalAmount: 100,
    poDate: "2026-08-01",
    lineItems: []
  },
  historicalInvoices: [],
  recentInvoices: [],
  ruleConfig: mergeAnomalyConfig(),
  currentDate: new Date("2026-08-20T00:00:00.000Z"),
  ...overrides
});

/**
 * Layer 1: Validation Tests
 * Test that the validation layer correctly identifies missing data
 */
const validationTests: TestCase[] = [
  {
    name: "validation: minimal required fields present",
    run: () => {
      const result = ValidationLayer.validateMinimalRequiredFields(baseContext().invoice);
      assert.equal(result.canEvaluate, true);
      assert.equal(result.missingFields.length, 0);
    }
  },
  {
    name: "validation: missing invoice number and id",
    run: () => {
      const result = ValidationLayer.validateMinimalRequiredFields({
        ...baseContext().invoice,
        id: undefined,
        invoiceNumber: undefined
      });
      assert.equal(result.canEvaluate, false);
      assert.equal(result.missingFields.length > 0, true);
    }
  },
  {
    name: "validation: missing total amount",
    run: () => {
      const result = ValidationLayer.validateMinimalRequiredFields({
        ...baseContext().invoice,
        totalAmount: undefined
      });
      assert.equal(result.canEvaluate, false);
      assert.equal(result.missingFields.length > 0, true);
    }
  },
  {
    name: "validation: missing invoice date",
    run: () => {
      const result = ValidationLayer.validateMinimalRequiredFields({
        ...baseContext().invoice,
        invoiceDate: undefined
      });
      assert.equal(result.canEvaluate, false);
      assert.equal(result.missingFields.length > 0, true);
    }
  },
  {
    name: "validation: vendor context available",
    run: () => {
      const result = ValidationLayer.validateVendorContext(baseContext());
      assert.equal(result.canEvaluate, true);
      assert.equal(result.missingFields.length, 0);
    }
  },
  {
    name: "validation: vendor context missing",
    run: () => {
      const result = ValidationLayer.validateVendorContext(baseContext({ vendor: undefined }));
      assert.equal(result.canEvaluate, false);
      assert.equal(result.missingFields.length > 0, true);
    }
  },
  {
    name: "validation: historical data sufficient",
    run: () => {
      const result = ValidationLayer.validateHistoricalData(baseContext(), 0);
      assert.equal(result.canEvaluate, true);
    }
  },
  {
    name: "validation: historical data insufficient",
    run: () => {
      const result = ValidationLayer.validateHistoricalData(baseContext({ historicalInvoices: [] }), 3);
      assert.equal(result.canEvaluate, false);
      assert.equal(result.missingFields.length > 0, true);
    }
  },
  {
    name: "validation: tax data present",
    run: () => {
      const result = ValidationLayer.validateTaxData({
        ...baseContext().invoice,
        gstin: "27ABCDE1234F1Z5",
        taxAmount: 10
      });
      assert.equal(result.canEvaluate, true);
    }
  },
  {
    name: "validation: tax data missing",
    run: () => {
      const result = ValidationLayer.validateTaxData({
        ...baseContext().invoice,
        gstin: undefined,
        taxAmount: undefined
      });
      assert.equal(result.canEvaluate, false);
      assert.equal(result.missingFields.length > 0, true);
    }
  },
  {
    name: "validation: line items present",
    run: () => {
      const result = ValidationLayer.validateLineItems({
        ...baseContext().invoice,
        lineItems: [{ sku: "A", quantity: 10, amount: 100 }]
      });
      assert.equal(result.canEvaluate, true);
    }
  },
  {
    name: "validation: line items missing",
    run: () => {
      const result = ValidationLayer.validateLineItems({
        ...baseContext().invoice,
        lineItems: []
      });
      assert.equal(result.canEvaluate, false);
      assert.equal(result.missingFields.length > 0, true);
    }
  }
];

/**
 * Layer 2: Duplicate & Reuse Detection Tests
 * Test various conditions from the matrix
 */
const duplicateDetectionTests: TestCase[] = [
  {
    name: "duplicate: exact duplicate hardblock",
    run: async () => {
      const rule = new DuplicateInvoiceRule();
      const signal = await rule.evaluate(
        baseContext({
          historicalInvoices: [{ id: "OLD", vendorId: "V1", invoiceNumber: "INV-001", totalAmount: 100 }]
        })
      );
      assert.equal(signal?.type, "DUPLICATE_INVOICE");
      assert.equal(signal?.metadata?.hardBlock, true);
    }
  },
  {
    name: "duplicate: no signal when no historical data",
    run: async () => {
      const rule = new DuplicateInvoiceRule();
      const signal = await rule.evaluate(baseContext({ historicalInvoices: [] }));
      assert.equal(signal, null);
    }
  },
  {
    name: "duplicate: no signal with missing invoice number and amount",
    run: async () => {
      const rule = new DuplicateInvoiceRule();
      const signal = await rule.evaluate(
        baseContext({
          invoice: { ...baseContext().invoice, invoiceNumber: undefined, totalAmount: undefined }
        })
      );
      assert.equal(signal, null);
    }
  },
  {
    name: "duplicate: potential duplicate within window",
    run: async () => {
      const rule = new DuplicateInvoiceRule();
      const signal = await rule.evaluate(
        baseContext({
          invoice: { ...baseContext().invoice, invoiceNumber: "NEW-001", totalAmount: 100 },
          recentInvoices: [
            { id: "OLD", vendorId: "V1", invoiceNumber: "OLD-001", totalAmount: 100, invoiceDate: "2026-08-19" }
          ]
        })
      );
      assert.equal(signal?.type, "POTENTIAL_DUPLICATE_INVOICE");
    }
  },
  {
    name: "duplicate: similar invoice detected",
    run: async () => {
      const rule = new DuplicateInvoiceRule();
      const signal = await rule.evaluate(
        baseContext({
          invoice: { ...baseContext().invoice, invoiceNumber: "INV-001", totalAmount: 100 },
          historicalInvoices: [
            { id: "OLD", vendorId: "V1", invoiceNumber: "INV-002", totalAmount: 100 }
          ]
        })
      );
      assert.equal(signal?.type, "SIMILAR_INVOICE");
    }
  },
  {
    name: "duplicate: different vendor no match",
    run: async () => {
      const rule = new DuplicateInvoiceRule();
      const signal = await rule.evaluate(
        baseContext({
          historicalInvoices: [{ id: "OLD", vendorId: "V2", invoiceNumber: "INV-001", totalAmount: 100 }]
        })
      );
      assert.equal(signal, null);
    }
  }
];

/**
 * Layer 2: Purchase-Order Validation Tests
 */
const purchaseOrderTests: TestCase[] = [
  {
    name: "po: PO exists and matches",
    run: async () => {
      const rule = new (await import("../rules/poNotFound.rule")).PoNotFoundRule();
      const signal = await rule.evaluate(baseContext());
      assert.equal(signal, null);
    }
  },
  {
    name: "po: PO missing for PO-based invoice",
    run: async () => {
      const rule = new (await import("../rules/poNotFound.rule")).PoNotFoundRule();
      const signal = await rule.evaluate(baseContext({ purchaseOrder: undefined }));
      assert.equal(signal?.type, "PO_NOT_FOUND");
    }
  },
  {
    name: "po: missing PO reference",
    run: async () => {
      const rule = new (await import("../rules/poNotFound.rule")).PoNotFoundRule();
      const signal = await rule.evaluate(
        baseContext({
          invoice: { ...baseContext().invoice, poId: null, poNumber: null }
        })
      );
      assert.equal(signal?.type, "MISSING_PO_REFERENCE");
    }
  },
  {
    name: "po: NON_PO invoice no validation",
    run: async () => {
      const rule = new (await import("../rules/poNotFound.rule")).PoNotFoundRule();
      const signal = await rule.evaluate(
        baseContext({
          invoice: { ...baseContext().invoice, invoiceType: "NON_PO" },
          purchaseOrder: undefined
        })
      );
      assert.equal(signal, null);
    }
  },
  {
    name: "po: vendor mismatch between invoice and PO",
    run: async () => {
      const rule = new (await import("../rules/poNotFound.rule")).PoNotFoundRule();
      const signal = await rule.evaluate(
        baseContext({
          purchaseOrder: { ...baseContext().purchaseOrder!, vendorId: "V2" }
        })
      );
      assert.equal(signal?.type, "PO_VENDOR_MISMATCH");
    }
  }
];

/**
 * Layer 4: Hard-Block Precedence Tests
 * Test that hard blocks override numerical scoring
 */
const hardBlockTests: TestCase[] = [
  {
    name: "hardblock: exact duplicate blocks invoice",
    run: async () => {
      const result = await new AnomalyEngine().evaluate(
        baseContext({
          historicalInvoices: [{ id: "OLD", vendorId: "V1", invoiceNumber: "INV-001" }]
        })
      );
      assert.equal(result.decision.status, "BLOCKED");
      assert.equal(result.signals.some((s) => s.type === "DUPLICATE_INVOICE"), true);
    }
  },
  {
    name: "hardblock: BLOCKED status in decision",
    run: async () => {
      const result = await new AnomalyEngine().evaluate(
        baseContext({
          historicalInvoices: [{ id: "OLD", vendorId: "V1", invoiceNumber: "INV-001", totalAmount: 100 }]
        })
      );
      assert.equal(result.decision.status, "BLOCKED");
      assert(result.decision.reason.includes("Duplicate") || result.decision.reason.includes("duplicate"));
    }
  }
];

async function run() {
  console.log("Running Layer 1: Validation Tests...");
  for (const test of validationTests) {
    await test.run();
    console.log(`ok - ${test.name}`);
  }

  console.log("\nRunning Layer 2: Duplicate Detection Tests...");
  for (const test of duplicateDetectionTests) {
    await test.run();
    console.log(`ok - ${test.name}`);
  }

  console.log("\nRunning Layer 2: Purchase-Order Validation Tests...");
  for (const test of purchaseOrderTests) {
    await test.run();
    console.log(`ok - ${test.name}`);
  }

  console.log("\nRunning Layer 4: Hard-Block Tests...");
  for (const test of hardBlockTests) {
    await test.run();
    console.log(`ok - ${test.name}`);
  }

  const totalTests = validationTests.length + duplicateDetectionTests.length + purchaseOrderTests.length + hardBlockTests.length;
  console.log(`\n${totalTests} matrix-based tests passed`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
