import assert from "node:assert/strict";
import { CategorizationService } from "../categorization.service";
import type { InvoiceCategorizationProvider } from "../categorization.types";
import type { StructuredInvoiceData } from "../../extraction";

type TestCase = { name: string; run: () => Promise<void> | void };

class StaticProvider implements InvoiceCategorizationProvider {
  constructor(private readonly raw: unknown) {}

  async categorizeInvoice(): Promise<unknown> {
    return this.raw;
  }
}

const invoice: StructuredInvoiceData = {
  invoiceNumber: "INV-1024",
  invoiceDate: new Date("2026-08-20T00:00:00.000Z"),
  vendorName: "ABC Technologies",
  gstin: null,
  poNumber: null,
  subtotal: 40000,
  tax: 8000,
  total: 48000,
  dueDate: null,
  items: [
    {
      description: "Laptop",
      quantity: 2,
      unitPrice: 20000,
      taxRate: 18,
      amount: 40000
    }
  ]
};

const tests: TestCase[] = [
  {
    name: "categorization: IT Equipment preserved",
    run: async () => {
      const service = new CategorizationService(new StaticProvider({
        category: "IT Equipment",
        confidence: 0.96,
        reason: "The invoice primarily contains computer hardware."
      }));
      const result = await service.categorize(invoice);
      assert.equal(result.category, "IT Equipment");
      assert.equal(result.confidence, 0.96);
      assert.equal(result.status, "HIGH_CONFIDENCE");
    }
  },
  {
    name: "categorization: Software / SaaS preserved",
    run: async () => {
      const service = new CategorizationService(new StaticProvider({
        category: "Software / SaaS",
        confidence: 0.9,
        reason: "Subscription software."
      }));
      const result = await service.categorize(invoice);
      assert.equal(result.category, "Software / SaaS");
    }
  },
  {
    name: "categorization: Office Supplies preserved",
    run: async () => {
      const service = new CategorizationService(new StaticProvider({
        category: "Office Supplies",
        confidence: 0.86,
        reason: "Office stationery."
      }));
      const result = await service.categorize(invoice);
      assert.equal(result.category, "Office Supplies");
    }
  },
  {
    name: "categorization: Travel preserved",
    run: async () => {
      const service = new CategorizationService(new StaticProvider({
        category: "Travel",
        confidence: 0.8,
        reason: "Travel booking."
      }));
      const result = await service.categorize(invoice);
      assert.equal(result.category, "Travel");
    }
  },
  {
    name: "categorization: Professional Services preserved",
    run: async () => {
      const service = new CategorizationService(new StaticProvider({
        category: "Professional Services",
        confidence: 0.82,
        reason: "Consulting service."
      }));
      const result = await service.categorize(invoice);
      assert.equal(result.category, "Professional Services");
    }
  },
  {
    name: "categorization: unknown Gemini category maps to Other",
    run: async () => {
      const service = new CategorizationService(new StaticProvider({
        category: "Fraud Risk",
        confidence: 0.99,
        reason: "Unsupported label."
      }));
      const result = await service.categorize(invoice);
      assert.equal(result.category, "Other");
      assert.equal(result.confidence, 0.99);
      assert.match(result.reason, /unsupported category/i);
    }
  },
  {
    name: "categorization: low confidence is preserved",
    run: async () => {
      const service = new CategorizationService(new StaticProvider({
        category: "Maintenance",
        confidence: 0.42,
        reason: "Could be repair parts."
      }));
      const result = await service.categorize(invoice);
      assert.equal(result.category, "Maintenance");
      assert.equal(result.confidence, 0.42);
      assert.equal(result.status, "LOW_CONFIDENCE");
    }
  },
  {
    name: "categorization: malformed response becomes failed Other",
    run: async () => {
      const service = new CategorizationService(new StaticProvider({ category: "IT Equipment" }));
      const result = await service.categorize(invoice);
      assert.equal(result.category, "Other");
      assert.equal(result.status, "FAILED");
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

  console.log(`${tests.length} categorization tests passed`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
