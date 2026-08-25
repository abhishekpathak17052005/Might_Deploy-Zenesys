import assert from "node:assert/strict";
import { CategorizationService, categorizationService } from "../categorization.service";
import type { StructuredInvoiceData } from "../../extraction";

type TestCase = { name: string; run: () => Promise<void> | void };

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
      const result = categorizationService.categorize({
        vendorName: invoice.vendorName,
        description: invoice.items[0].description,
        lineItems: invoice.items
      });
      assert.equal(result.category, "IT Equipment");
      assert(result.confidence > 0, "Confidence should be greater than 0");
      assert.equal(result.status, "HIGH_CONFIDENCE");
    }
  },
  {
    name: "categorization: Software / SaaS preserved",
    run: async () => {
      const result = categorizationService.categorize({
        vendorName: "Microsoft",
        description: "Office 365 subscription",
        lineItems: [{ description: "Software license" }]
      });
      assert.equal(result.category, "Software / SaaS");
      assert(result.confidence > 0, "Confidence should be greater than 0");
    }
  },
  {
    name: "categorization: Office Supplies preserved",
    run: async () => {
      const result = categorizationService.categorize({
        vendorName: "Office Depot",
        description: "Office stationery supplies",
        lineItems: [{ description: "Paper and notebooks" }]
      });
      assert.equal(result.category, "Office Supplies");
      assert(result.confidence > 0, "Confidence should be greater than 0");
    }
  },
  {
    name: "categorization: Travel preserved",
    run: async () => {
      const result = categorizationService.categorize({
        vendorName: "Hotels.com",
        description: "Hotel booking",
        lineItems: [{ description: "Accommodation" }]
      });
      assert.equal(result.category, "Travel");
      assert(result.confidence > 0, "Confidence should be greater than 0");
    }
  },
  {
    name: "categorization: Professional Services preserved",
    run: async () => {
      const result = categorizationService.categorize({
        vendorName: "Accenture Consulting",
        description: "Consulting services",
        lineItems: [{ description: "Professional consulting" }]
      });
      assert.equal(result.category, "Professional Services");
      assert(result.confidence > 0, "Confidence should be greater than 0");
    }
  },
  {
    name: "categorization: Utilities preserved",
    run: async () => {
      const result = categorizationService.categorize({
        vendorName: "City Power Company",
        description: "Electricity bill",
        lineItems: [{ description: "Monthly electricity supply" }]
      });
      assert.equal(result.category, "Utilities");
      assert(result.confidence > 0, "Confidence should be greater than 0");
    }
  },
  {
    name: "categorization: Maintenance preserved",
    run: async () => {
      const result = categorizationService.categorize({
        vendorName: "ABC Maintenance",
        description: "Equipment repair and maintenance",
        lineItems: [{ description: "Annual maintenance contract" }]
      });
      assert.equal(result.category, "Maintenance");
      assert(result.confidence > 0, "Confidence should be greater than 0");
      assert.equal(result.status, "LOW_CONFIDENCE");
    }
  },
  {
    name: "categorization: Marketing preserved",
    run: async () => {
      const result = categorizationService.categorize({
        vendorName: "Google",
        description: "Google Ads campaign",
        lineItems: [{ description: "Digital marketing advertisement" }]
      });
      assert.equal(result.category, "Marketing");
      assert(result.confidence > 0, "Confidence should be greater than 0");
    }
  },
  {
    name: "categorization: low confidence category",
    run: async () => {
      const result = categorizationService.categorize({
        vendorName: "Random Vendor",
        description: "Miscellaneous items",
        lineItems: [{ description: "General items" }]
      });
      assert.equal(result.category, "Other");
      assert.equal(result.status, "LOW_CONFIDENCE");
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
