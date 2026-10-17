import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OCRSpaceInvoiceProvider } from "../ocrSpaceInvoiceProvider";
import { applyOcrEvidenceFallback, extractLabelledSubtotal, extractLabelledTotal } from "../ocrTotalEvidence";
import { GeminiTextStructurer } from "../geminiTextStructurer";

describe("Evidence-Aware Invoice Extraction Regression Suite", () => {
  it("Scenario 1: extracts a clear numeric grand total distinctly from subtotal and tax", async () => {
    const ocrText = [
      "ACME SUPPLIES LTD",
      "Invoice: INV-1001",
      "Sub-Total 40000.00",
      "GST 7200.00",
      "Grand Total 47200.00",
      "1 Office Chairs 40000",
    ].join("\n");

    const provider = new OCRSpaceInvoiceProvider(
      { extractInvoice: async () => ({ rawText: ocrText }) },
      {
        structure: async () => ({
          invoice_number: "INV-1001",
          invoice_date: null,
          vendor_name: "ACME SUPPLIES LTD",
          gstin: null,
          po_number: null,
          subtotal: 40000,
          tax: 7200,
          total: 47200,
          items: [{ description: "Office Chairs", quantity: 1, unit_price: 40000, amount: 40000, evidence: "1 Office Chairs 40000" }],
          rawText: ocrText,
          provenance: {
            subtotal: { value: 40000, source: "Sub-Total 40000.00" },
            tax: { value: 7200, source: "GST 7200.00" },
            total: { value: 47200, source: "Grand Total 47200.00" },
          },
          structuringProvider: "groq",
        }),
      },
    );

    const result = await provider.extractInvoice({
      documentBuffer: Buffer.from("dummy"),
      mimeType: "image/png",
      filename: "invoice.png",
    }) as any;

    assert.equal(result.subtotal, 40000);
    assert.equal(result.tax, 7200);
    assert.equal(result.total, 47200);
    assert.notEqual(result.subtotal, result.total);
    assert.equal(result.items.length, 1);
  });

  it("Scenario 2: keeps subtotal distinct and never copies subtotal into missing grand total", async () => {
    const ocrText = [
      "SUNKISE ENTERPRISE",
      "Sub-Total 38025.84",
      "1 Executive Diary",
      "2 Ball Pen 20",
    ].join("\n");

    const structured = {
      invoice_number: null,
      invoice_date: null,
      vendor_name: "SUNKISE ENTERPRISE",
      gstin: null,
      po_number: null,
      subtotal: 38025.84,
      tax: null,
      total: null,
      items: [
        { description: "Executive Diary", quantity: null, unit_price: null, amount: null },
        { description: "Ball Pen", quantity: null, unit_price: 20, amount: null },
      ],
      rawText: ocrText,
      provenance: {
        subtotal: { value: 38025.84, source: "Sub-Total 38025.84", confidence: null },
        total: { value: null, source: null, confidence: null },
      },
      structuringProvider: "groq",
    };

    const withFallback = applyOcrEvidenceFallback(structured, ocrText);

    assert.equal(withFallback.subtotal, 38025.84, "Subtotal must be preserved");
    assert.equal(withFallback.total, null, "Grand total must remain null when not printed");
    assert.notEqual(withFallback.subtotal, withFallback.total, "Subtotal must never be copied into total");
  });

  it("Scenario 3: refuses to invent a total from corrupted amount-in-words string", async () => {
    const ocrText = [
      "SUNKISE ENTERPKSE",
      "Sub-Total 38025.84",
      "Envorce Total in Word",
      "Rupees ThirtyE Sht Thousand Twent So Once",
    ].join("\n");

    const extractedTotal = extractLabelledTotal(ocrText);
    assert.equal(extractedTotal, null, "Corrupted words must not produce a fabricated numeric total");

    const extractedSubtotal = extractLabelledSubtotal(ocrText);
    assert.equal(extractedSubtotal?.value, 38025.84, "Subtotal is extracted from distinct Sub-Total label");
  });

  it("Scenario 4: preserves incomplete line items without hallucinating missing prices or quantities", async () => {
    const ocrText = [
      "ACME CATERING",
      "1 Mini Batata Wada",
      "2 Drinking Water",
      "3 Special Lunch 1500",
      "Sub-Total 1500",
    ].join("\n");

    const fallbackResult = applyOcrEvidenceFallback({
      invoice_number: null,
      invoice_date: null,
      vendor_name: null,
      gstin: null,
      po_number: null,
      subtotal: null,
      tax: null,
      total: null,
      items: [
        { description: "Mini Batata Wada", quantity: null, unit_price: null, amount: null },
        { description: "Drinking Water", quantity: null, unit_price: null, amount: null },
        { description: "Special Lunch", quantity: null, unit_price: null, amount: 1500 },
      ],
      rawText: ocrText,
      provenance: {},
      structuringProvider: "groq",
    }, ocrText);

    assert.equal(fallbackResult.items[0].description, "Mini Batata Wada");
    assert.equal(fallbackResult.items[0].quantity, null, "Unquoted quantity must remain null");
    assert.equal(fallbackResult.items[0].unit_price, null, "Unquoted unit price must remain null");
    assert.equal(fallbackResult.items[2].amount, 1500);
    assert.equal(fallbackResult.tax, null, "Missing tax must remain null");
  });

  it("Scenario 5: gracefully handles Gemini HTTP errors (404, 429, 503) and malformed responses", async () => {
    const structurer404 = new GeminiTextStructurer(
      () => "test-key",
      () => "deprecated-model",
      async () => new Response(JSON.stringify({ error: { code: 404, message: "model not found" } }), { status: 404 }),
    );
    await assert.rejects(structurer404.structure("some text"), /Gemini structuring request failed \(HTTP 404\)/);

    const structurer429 = new GeminiTextStructurer(
      () => "test-key",
      () => "test-model",
      async () => new Response(JSON.stringify({ error: { code: 429, message: "Quota exceeded" } }), { status: 429 }),
    );
    await assert.rejects(structurer429.structure("some text"), /Gemini rate limit or quota reached/);

    const structurerMalformed = new GeminiTextStructurer(
      () => "test-key",
      () => "test-model",
      async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "not-json" }] } }] }), { status: 200 }),
    );
    await assert.rejects(structurerMalformed.structure("some text"), /Gemini returned invalid structured invoice JSON/);
  });

  it("Scenario 6: flags valid partial extraction as requiring human review when total is missing", async () => {
    const incompleteGroq = {
      invoice_number: null,
      invoice_date: null,
      vendor_name: "SUNKISE ENTERPKSE",
      gstin: null,
      po_number: null,
      subtotal: 38025.84,
      tax: null,
      total: null,
      items: [{ description: "Executive Diary", quantity: null, unit_price: null, amount: null }],
      rawText: "Sub-Total 38025.84",
      provenance: { subtotal: { value: 38025.84, source: "Sub-Total 38025.84" } },
      structuringProvider: "groq",
    };

    const provider = new OCRSpaceInvoiceProvider(
      { extractInvoice: async () => ({ rawText: "Sub-Total 38025.84" }) },
      { structure: async () => incompleteGroq },
      { structure: async () => ({ ...incompleteGroq, structuringProvider: "gemini_text_structurer" }) },
    );

    const result = await provider.extractInvoice({
      documentBuffer: Buffer.from("dummy"),
      mimeType: "image/png",
      filename: "invoice.png",
    }) as any;

    assert.equal(result.total, null, "Total cannot be resolved from source text");
    assert.equal(result.subtotal, 38025.84);
    assert.match(result.structuringError, /did not find a supported invoice total/);
  });
});
