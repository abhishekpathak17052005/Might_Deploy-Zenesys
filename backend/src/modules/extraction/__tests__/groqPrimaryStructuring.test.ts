import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OCRSpaceInvoiceProvider } from "../ocrSpaceInvoiceProvider";

describe("Groq Primary Structurer with Gemini Fallback", () => {
  const ocrText = [
    "ACME SUPPLIES LTD",
    "Invoice Number: INV-9876",
    "Invoice Date: 2026-10-15",
    "GSTIN: 27AABCU9603R1ZM",
    "1 Laptop Computer 50000",
    "2 Wireless Mouse 1500",
    "Total Amount: INR 51500",
  ].join("\n");

  const groqSuccessData = {
    invoice_number: "INV-9876",
    invoice_date: "2026-10-15",
    vendor_name: "ACME SUPPLIES LTD",
    gstin: "27AABCU9603R1ZM",
    po_number: null,
    subtotal: 51500,
    tax: 0,
    total: 51500,
    due_date: null,
    items: [
      { description: "Laptop Computer", quantity: 1, unit_price: 50000, amount: 50000 },
      { description: "Wireless Mouse", quantity: 2, unit_price: 750, amount: 1500 },
    ],
    rawText: ocrText,
    provenance: { total: { value: 51500, source: "Total: 51500" } },
    structuringProvider: "groq_text_fallback",
  };

  const geminiSuccessData = {
    ...groqSuccessData,
    structuringProvider: "gemini_text_structurer",
  };

  it("calls Groq first and returns groq structuring without calling Gemini fallback when Groq succeeds", async () => {
    let groqCalls = 0;
    let geminiCalls = 0;

    const provider = new OCRSpaceInvoiceProvider(
      { extractInvoice: async () => ({ rawText: ocrText }) },
      { structure: async () => { groqCalls += 1; return groqSuccessData; } },
      { structure: async () => { geminiCalls += 1; return geminiSuccessData; } },
    );

    const result = await provider.extractInvoice({
      documentBuffer: Buffer.from("dummy-invoice"),
      mimeType: "image/png",
      filename: "invoice.png",
    }) as any;

    assert.equal(groqCalls, 1);
    assert.equal(geminiCalls, 0, "Gemini fallback should not be called when Groq succeeds");
    assert.equal(result.total, 51500);
    assert.equal(result.structuringProvider, "groq");
    assert.equal(result.items.length, 2);
  });

  it("falls back to Gemini when Groq returns HTTP 429 rate limit", async () => {
    let groqCalls = 0;
    let geminiCalls = 0;

    const provider = new OCRSpaceInvoiceProvider(
      { extractInvoice: async () => ({ rawText: ocrText }) },
      { structure: async () => { groqCalls += 1; throw new Error("Groq rate limit or quota reached while structuring OCR text."); } },
      { structure: async () => { geminiCalls += 1; return geminiSuccessData; } },
    );

    const result = await provider.extractInvoice({
      documentBuffer: Buffer.from("dummy-invoice"),
      mimeType: "image/png",
      filename: "invoice.png",
    }) as any;

    assert.equal(groqCalls, 1);
    assert.equal(geminiCalls, 1, "Gemini fallback should be called when Groq hits 429");
    assert.equal(result.total, 51500);
    assert.match(result.structuringFallbackReason, /Groq temporarily unavailable after retries/);
  });

  it("falls back to Gemini when Groq returns incomplete fields and Gemini has complete fields", async () => {
    let groqCalls = 0;
    let geminiCalls = 0;

    const incompleteGroq = {
      ...groqSuccessData,
      total: null,
      items: [],
      structuringProvider: "groq_text_fallback",
    };

    const provider = new OCRSpaceInvoiceProvider(
      { extractInvoice: async () => ({ rawText: ocrText }) },
      { structure: async () => { groqCalls += 1; return incompleteGroq; } },
      { structure: async () => { geminiCalls += 1; return geminiSuccessData; } },
    );

    const result = await provider.extractInvoice({
      documentBuffer: Buffer.from("dummy-invoice"),
      mimeType: "image/png",
      filename: "invoice.png",
    }) as any;

    assert.equal(groqCalls, 1);
    assert.equal(geminiCalls, 1);
    assert.equal(result.total, 51500);
    assert.equal(result.structuringFallbackReason, "Groq returned incomplete invoice fields");
  });

  it("degrades gracefully to OCR deterministic rules when both Groq and Gemini fail", async () => {
    const provider = new OCRSpaceInvoiceProvider(
      { extractInvoice: async () => ({ rawText: ocrText }) },
      { structure: async () => { throw new Error("Groq rate limit or quota reached while structuring OCR text."); } },
      { structure: async () => { throw new Error("Gemini rate limit or quota reached while structuring OCR text."); } },
    );

    const result = await provider.extractInvoice({
      documentBuffer: Buffer.from("dummy-invoice"),
      mimeType: "image/png",
      filename: "invoice.png",
    }) as any;

    assert.equal(result.total, 51500);
    assert.equal(result.structuringProvider, "ocr_text_rules");
    assert.match(result.structuringError, /Groq was temporarily unavailable; Gemini fallback failed/);
  });
});
