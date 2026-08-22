import assert from "node:assert/strict";
import { ExtractionService } from "../extraction.service";
import { validateExtractedInvoiceMath } from "../extraction.validator";
import type { InvoiceExtractionProvider, StructuredInvoiceData } from "../extraction.types";

type TestCase = { name: string; run: () => Promise<void> | void };

class StaticProvider implements InvoiceExtractionProvider {
  constructor(private readonly raw: unknown) {}

  async extractInvoice(): Promise<unknown> {
    return this.raw;
  }
}

const validRawExtraction = {
  invoice_number: { value: "INV-1024", confidence: 0.98 },
  invoice_date: { value: "2026-08-20", confidence: 0.96 },
  vendor_name: { value: "ABC Technologies", confidence: 0.97 },
  gstin: { value: "27ABCDE1234F1Z5", confidence: 0.98 },
  po_number: { value: "PO-1001", confidence: 0.94 },
  subtotal: { value: 40000, confidence: 0.99 },
  tax: { value: 8000, confidence: 0.99 },
  total: { value: 48000, confidence: 0.99 },
  due_date: { value: "2026-09-20", confidence: 0.91 },
  items: [
    {
      description: "Laptop",
      quantity: 2,
      unit_price: 20000,
      tax_rate: 18,
      amount: 40000
    }
  ]
};

const validInvoice: StructuredInvoiceData = {
  invoiceNumber: "INV-1024",
  invoiceDate: new Date("2026-08-20T00:00:00.000Z"),
  vendorName: "ABC Technologies",
  gstin: "27ABCDE1234F1Z5",
  poNumber: "PO-1001",
  subtotal: 40000,
  tax: 8000,
  total: 48000,
  dueDate: new Date("2026-09-20T00:00:00.000Z"),
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
    name: "extraction: valid Gemini response normalizes to structured invoice",
    run: async () => {
      const service = new ExtractionService(new StaticProvider(validRawExtraction));
      const result = await service.extract({
        documentBuffer: Buffer.from("pdf"),
        mimeType: "application/pdf",
        filename: "invoice.pdf"
      });

      assert.equal(result.invoice.invoiceNumber, "INV-1024");
      assert.equal(result.invoice.vendorName, "ABC Technologies");
      assert.equal(result.invoice.gstin, "27ABCDE1234F1Z5");
      assert.equal(result.validation.status, "VALID");
      assert.equal(result.confidence.gstin.status, "EXTRACTED");
    }
  },
  {
    name: "extraction: malformed Gemini response is rejected",
    run: async () => {
      const service = new ExtractionService(new StaticProvider({ message: "not invoice json" }));
      await assert.rejects(
        service.extract({
          documentBuffer: Buffer.from("pdf"),
          mimeType: "application/pdf",
          filename: "invoice.pdf"
        })
      );
    }
  },
  {
    name: "extraction: missing invoice number is rejected",
    run: async () => {
      const raw = { ...validRawExtraction, invoice_number: { value: null, confidence: 0.2 } };
      const service = new ExtractionService(new StaticProvider(raw));
      await assert.rejects(
        service.extract({
          documentBuffer: Buffer.from("pdf"),
          mimeType: "application/pdf",
          filename: "invoice.pdf"
        })
      );
    }
  },
  {
    name: "extraction: invalid date is rejected",
    run: async () => {
      const raw = { ...validRawExtraction, invoice_date: "2026-99-99" };
      const service = new ExtractionService(new StaticProvider(raw));
      await assert.rejects(
        service.extract({
          documentBuffer: Buffer.from("pdf"),
          mimeType: "application/pdf",
          filename: "invoice.pdf"
        })
      );
    }
  },
  {
    name: "extraction: invalid amount type is rejected",
    run: async () => {
      const raw = { ...validRawExtraction, total: "48000" };
      const service = new ExtractionService(new StaticProvider(raw));
      await assert.rejects(
        service.extract({
          documentBuffer: Buffer.from("pdf"),
          mimeType: "application/pdf",
          filename: "invoice.pdf"
        })
      );
    }
  },
  {
    name: "extraction: malformed line item is rejected",
    run: async () => {
      const raw = { ...validRawExtraction, items: [{ description: "Laptop", quantity: 2 }] };
      const service = new ExtractionService(new StaticProvider(raw));
      await assert.rejects(
        service.extract({
          documentBuffer: Buffer.from("pdf"),
          mimeType: "application/pdf",
          filename: "invoice.pdf"
        })
      );
    }
  },
  {
    name: "extraction: missing GSTIN remains allowed and traceable",
    run: async () => {
      const raw = { ...validRawExtraction, gstin: null };
      const service = new ExtractionService(new StaticProvider(raw));
      const result = await service.extract({
        documentBuffer: Buffer.from("pdf"),
        mimeType: "application/pdf",
        filename: "invoice.pdf"
      });

      assert.equal(result.invoice.gstin, null);
      assert.equal(result.confidence.gstin.status, "MISSING");
    }
  },
  {
    name: "extraction: missing PO remains allowed and traceable",
    run: async () => {
      const raw = { ...validRawExtraction, po_number: null };
      const service = new ExtractionService(new StaticProvider(raw));
      const result = await service.extract({
        documentBuffer: Buffer.from("pdf"),
        mimeType: "application/pdf",
        filename: "invoice.pdf"
      });

      assert.equal(result.invoice.poNumber, null);
      assert.equal(result.confidence.poNumber.status, "MISSING");
    }
  },
  {
    name: "extraction: new vendor does not block extraction",
    run: async () => {
      const raw = { ...validRawExtraction, vendor_name: "New Vendor Pvt Ltd" };
      const service = new ExtractionService(new StaticProvider(raw));
      const result = await service.extract({
        documentBuffer: Buffer.from("pdf"),
        mimeType: "application/pdf",
        filename: "invoice.pdf"
      });

      assert.equal(result.invoice.vendorName, "New Vendor Pvt Ltd");
      assert.equal(result.validation.status, "VALID");
    }
  },
  {
    name: "validation: quantity times price equals amount",
    run: () => {
      const validation = validateExtractedInvoiceMath(validInvoice);
      assert.equal(validation.findings.some((finding) => finding.type === "LINE_ITEM_AMOUNT_MISMATCH"), false);
    }
  },
  {
    name: "validation: quantity times price mismatch creates finding",
    run: () => {
      const invoice = { ...validInvoice, items: [{ ...validInvoice.items[0], amount: 41000 }] };
      const validation = validateExtractedInvoiceMath(invoice);
      assert.ok(validation.findings.some((finding) => finding.type === "LINE_ITEM_AMOUNT_MISMATCH"));
    }
  },
  {
    name: "validation: subtotal matches items",
    run: () => {
      const validation = validateExtractedInvoiceMath(validInvoice);
      assert.equal(validation.findings.some((finding) => finding.type === "SUBTOTAL_MISMATCH"), false);
    }
  },
  {
    name: "validation: subtotal mismatch creates finding",
    run: () => {
      const validation = validateExtractedInvoiceMath({ ...validInvoice, subtotal: 42000 });
      assert.ok(validation.findings.some((finding) => finding.type === "SUBTOTAL_MISMATCH"));
    }
  },
  {
    name: "validation: subtotal plus tax equals total",
    run: () => {
      const validation = validateExtractedInvoiceMath(validInvoice);
      assert.equal(validation.findings.some((finding) => finding.type === "TOTAL_MISMATCH"), false);
    }
  },
  {
    name: "validation: total mismatch creates expected evidence",
    run: () => {
      const validation = validateExtractedInvoiceMath({ ...validInvoice, total: 52000 });
      const finding = validation.findings.find((item) => item.type === "TOTAL_MISMATCH");
      assert.ok(finding);
      assert.equal(finding?.expected, 48000);
      assert.equal(finding?.actual, 52000);
      assert.equal(finding?.difference, 4000);
    }
  },
  {
    name: "validation: negative values are flagged",
    run: () => {
      const invoice = { ...validInvoice, tax: -1 };
      const validation = validateExtractedInvoiceMath(invoice);
      assert.ok(validation.findings.some((finding) => finding.type === "NEGATIVE_VALUE"));
    }
  },
  {
    name: "validation: money tolerance avoids naive floating-point failure",
    run: () => {
      const invoice = {
        ...validInvoice,
        subtotal: 0.3,
        tax: 0.1,
        total: 0.4,
        items: [{ ...validInvoice.items[0], quantity: 3, unitPrice: 0.1, amount: 0.3 }]
      };
      const validation = validateExtractedInvoiceMath(invoice);
      assert.equal(validation.status, "VALID");
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

  console.log(`${tests.length} extraction tests passed`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
