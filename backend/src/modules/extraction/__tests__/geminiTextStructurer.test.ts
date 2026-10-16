import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GeminiTextStructurer } from "../geminiTextStructurer";
import { GroqTextStructurer } from "../groqTextStructurer";
import { extractLabelledTotal, extractNumberedLineItems } from "../ocrTotalEvidence";
import { OCRSpaceInvoiceProvider } from "../ocrSpaceInvoiceProvider";
import { ExtractionService } from "../extraction.service";

const text = "OM Caterers\nInvoice No: OM-1\nCatering services 1000 persons rate INR 100 INR 100000\nGrand Total: INR 100000";
const structured = {
  invoice_number: { value: "OM-1", evidence: "OM-1" },
  invoice_date: { value: null, evidence: null },
  vendor_name: { value: "OM Caterers", evidence: "OM Caterers" },
  gstin: { value: null, evidence: null },
  po_number: { value: null, evidence: null },
  subtotal: { value: null, evidence: null },
  tax: { value: null, evidence: null },
  total: { value: 100000, evidence: "Grand Total: INR 100000" },
  items: [{ description: "Catering services", quantity: 1000, unit_price: 100, amount: 100000, evidence: "Catering services 1000 persons rate INR 100 INR 100000" }],
};

describe("Gemini OCR text structuring", () => {
  it("recovers a printed Indian-format total only beside an explicit total label", () => {
    const result = extractLabelledTotal("Catering Details\n15 Drinking Water\nTotal Amount\n\u25A01,00,000/-\nAmount in Words: Rupees One Lakh Only");
    assert.deepEqual(result, { value: 100000, evidence: "Total Amount\n\u25A01,00,000/-" });
    assert.equal(extractLabelledTotal("Quantity 1000 Persons\n1,00,000"), null);
  });

  it("reads only numbered descriptions inside an explicit invoice details section", () => {
    const items = extractNumberedLineItems("Catering Details\nSr. No. Particulars\n1 Mix Puri\n2 Shak Bhaji\n15 Drinking Water\nTotal Amount\n1,00,000/-");
    assert.deepEqual(items.map(({ description }) => description), ["Mix Puri", "Shak Bhaji", "Drinking Water"]);
    assert.equal(items.every((item) => item.amount === null && item.quantity === null), true);
    assert.deepEqual(extractNumberedLineItems("1 Mix Puri\n2 Shak Bhaji"), []);
  });

  it("sends OCR text and retains only values with matching source evidence", async () => {
    let requestBody = "";
    let requestUrl = "";
    let requestHeaders: HeadersInit | undefined;
    const structurer = new GeminiTextStructurer(
      () => "test-key",
      () => "test-model",
      async (url, init) => {
        requestUrl = String(url);
        requestHeaders = init?.headers;
        requestBody = String(init?.body);
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(structured) }] } }] }), { status: 200 });
      },
    );
    const result = await structurer.structure(text);
    assert.equal(JSON.parse(requestBody).contents[0].parts[0].text.includes(text), true);
    assert.equal(requestUrl.includes("test-key"), false);
    assert.equal((requestHeaders as Record<string, string>)["x-goog-api-key"], "test-key");
    assert.equal(result.total, 100000);
    assert.equal(result.vendor_name, "OM Caterers");
    assert.equal((result.items as any[]).length, 1);
    assert.equal((result.provenance as any).total.source, "Grand Total: INR 100000");
    const normalized = new ExtractionService({ extractInvoice: async () => result }).normalize(result);
    assert.equal(normalized.invoice.total, 100000);
    assert.equal(normalized.invoice.items[0]?.quantity, 1000);
  });

  it("drops values without exact OCR evidence and refuses calculated fields", async () => {
    const hallucinated = { ...structured, total: { value: 999999, evidence: "Grand Total: INR 100000" }, vendor_name: { value: "Made Up Vendor", evidence: "not present" } };
    const structurer = new GeminiTextStructurer(() => "test-key", () => "test-model", async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(hallucinated) }] } }] }), { status: 200 }));
    const result = await structurer.structure(text);
    assert.equal(result.total, null);
    assert.equal(result.vendor_name, null);
  });

  it("normalizes a printed date and preserves item descriptions when prices are absent", async () => {
    const partial = {
      ...structured,
      invoice_date: { value: "2026-09-17", evidence: "Date 17 September 2026" },
      total: { value: null, evidence: null },
      items: [{ description: "Mix Puri", quantity: null, unit_price: null, amount: null, evidence: "Mix Puri" }],
    };
    const sourceText = "OM CATERERS\nDate 17 September 2026\nMix Puri";
    const structurer = new GeminiTextStructurer(() => "test-key", () => "test-model", async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(partial) }] } }] }), { status: 200 }));
    const result = await structurer.structure(sourceText);
    assert.equal(result.invoice_date, "2026-09-17");
    assert.equal((result.items as any[]).length, 1);
    assert.deepEqual(result.items, [{ description: "Mix Puri", quantity: null, unit_price: null, amount: null }]);
  });

  it("reports a rejected Gemini key as a configuration error", async () => {
    const structurer = new GeminiTextStructurer(
      () => "test-key",
      () => "test-model",
      async () => new Response(JSON.stringify({ error: { message: "API key not valid", status: "INVALID_ARGUMENT" } }), { status: 400 }),
    );
    await assert.rejects(structurer.structure(text), /Gemini rejected the configured backend API key/);
  });

  it("retries temporary Gemini 503 responses before structuring", async () => {
    let calls = 0;
    const structurer = new GeminiTextStructurer(
      () => "test-key",
      () => "test-model",
      async () => {
        calls += 1;
        if (calls === 1) return new Response("service unavailable", { status: 503 });
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(structured) }] } }] }), { status: 200 });
      },
    );
    const result = await structurer.structure(text);
    assert.equal(calls, 2);
    assert.equal(result.total, 100000);
  });

  it("reports persistent Gemini 503 as temporary service unavailability", async () => {
    let calls = 0;
    const structurer = new GeminiTextStructurer(
      () => "test-key",
      () => "test-model",
      async () => { calls += 1; return new Response("service unavailable", { status: 503 }); },
      20_000,
    );
    await assert.rejects(structurer.structure(text), /temporarily unavailable or overloaded after retries/);
    assert.equal(calls, 4);
  });

  it("keeps OCR-space raw text and recovers only a clearly labelled total when Gemini is not configured", async () => {
    const provider = new OCRSpaceInvoiceProvider(
      { extractInvoice: async () => ({ rawText: text, total: 100000 }) },
      new GeminiTextStructurer(() => undefined),
    );
    const result = await provider.extractInvoice({ documentBuffer: Buffer.from("x"), mimeType: "text/plain", filename: "x" }) as any;
    assert.equal(result.rawText, text);
    assert.equal(result.total, 100000);
    assert.equal(result.provenance.total.source, "Grand Total: INR 100000");
    assert.deepEqual(result.items, []);
    assert.equal(result.structuringProvider, "ocr_text_rules");
    assert.match(result.structuringError, /GEMINI_API_KEY/);
  });

  it("uses Groq only as a text-structuring fallback after a transient Gemini 503", async () => {
    let groqInput = "";
    const provider = new OCRSpaceInvoiceProvider(
      { extractInvoice: async () => ({ rawText: text }) },
      { structure: async () => { throw new Error("Gemini is temporarily unavailable or overloaded after retries."); } },
      { structure: async (ocrText) => { groqInput = ocrText; return { ...structured, structuringProvider: "groq_text_fallback" }; } },
    );
    const result = await provider.extractInvoice({ documentBuffer: Buffer.from("not sent to Groq"), mimeType: "image/jpeg", filename: "synthetic.jpg" }) as any;
    assert.equal(groqInput, text);
    assert.equal(result.structuringProvider, "groq_text_fallback");
    assert.equal(result.structuringFallbackReason, "Gemini temporarily unavailable after retries");
  });

  it("uses Groq text fallback when Gemini times out", async () => {
    let fallbackCalls = 0;
    const provider = new OCRSpaceInvoiceProvider(
      { extractInvoice: async () => ({ rawText: text }) },
      { structure: async () => { throw new Error("Gemini text structuring timed out."); } },
      { structure: async (ocrText) => { fallbackCalls += 1; return { ...structured, rawText: ocrText, structuringProvider: "groq_text_fallback" }; } },
    );
    const result = await provider.extractInvoice({ documentBuffer: Buffer.from("bytes"), mimeType: "image/jpeg", filename: "synthetic.jpg" }) as any;
    assert.equal(fallbackCalls, 1);
    assert.equal(result.structuringProvider, "groq_text_fallback");
    assert.equal(result.rawText, text);
  });

  it("tries Groq when Gemini returns a successful but incomplete structure", async () => {
    const partialGemini = { ...structured, total: null, vendor_name: "OM Caterers", items: [] };
    const groqResult = {
      ...partialGemini,
      total: 100000,
      items: [{ description: "Mix Puri", quantity: null, unit_price: null, amount: null }],
      structuringProvider: "groq_text_fallback",
    };
    let calls = 0;
    const provider = new OCRSpaceInvoiceProvider(
      { extractInvoice: async () => ({ rawText: text }) },
      { structure: async () => partialGemini },
      { structure: async (ocrText) => { calls += 1; assert.equal(ocrText, text); return groqResult; } },
    );
    const result = await provider.extractInvoice({ documentBuffer: Buffer.from("x"), mimeType: "image/jpeg", filename: "synthetic.jpg" }) as any;
    assert.equal(calls, 1);
    assert.equal(result.structuringProvider, "groq_text_fallback");
    assert.equal(result.total, 100000);
    assert.equal(result.items[0].description, "Mix Puri");
  });

  it("does not invoke Groq for invalid Gemini credentials", async () => {
    let fallbackCalls = 0;
    const provider = new OCRSpaceInvoiceProvider(
      { extractInvoice: async () => ({ rawText: text }) },
      { structure: async () => { throw new Error("Gemini rejected the configured backend API key. Check GEMINI_API_KEY."); } },
      { structure: async () => { fallbackCalls += 1; return {}; } },
    );
    const result = await provider.extractInvoice({ documentBuffer: Buffer.from("x"), mimeType: "image/jpeg", filename: "x.jpg" }) as any;
    assert.equal(fallbackCalls, 0);
    assert.equal(result.structuringProvider, "ocr_text_rules");
    assert.match(result.structuringError, /GEMINI_API_KEY/);
  });

  it("uses Groq fallback when Gemini reports rate limiting or quota exhaustion", async () => {
    let fallbackCalls = 0;
    const provider = new OCRSpaceInvoiceProvider(
      { extractInvoice: async () => ({ rawText: text }) },
      { structure: async () => { throw new Error("Gemini rate limit or quota reached while structuring OCR text."); } },
      { structure: async (ocrText) => { fallbackCalls += 1; return { ...structured, rawText: ocrText, structuringProvider: "groq_text_fallback" }; } },
    );
    const result = await provider.extractInvoice({ documentBuffer: Buffer.from("x"), mimeType: "image/jpeg", filename: "synthetic.jpg" }) as any;
    assert.equal(fallbackCalls, 1);
    assert.equal(result.structuringProvider, "groq_text_fallback");
  });

  it("uses evidence-only OCR rules when Gemini and Groq quotas are exhausted", async () => {
    const billText = [
      "OM CATERERS", "CATERING BILL", "Date 17 September 2026", "Quantity 1000 Persons",
      "Catering Details", "Sr. No. Particulars", "1 Mix Puri", "2 Shak Bhaji", "3 Bhendi Masala",
      "4 Rice", "5 Dal", "6 Gulab Jamun", "7 Papad", "8 Lonche", "9 Koshimbir",
      "10 Mini Batata Wada", "11 4 Buffet Counters", "12 Complete Service by Om Caterers",
      "13 20 Round Tables", "14 200 Chairs", "15 Drinking Water", "Total Amount", "■1,00,000/-",
    ].join("\n");
    const provider = new OCRSpaceInvoiceProvider(
      { extractInvoice: async () => ({ rawText: billText }) },
      { structure: async () => { throw new Error("Gemini rate limit or quota reached while structuring OCR text."); } },
      { structure: async () => { throw new Error("Groq rate limit or quota reached while structuring OCR text."); } },
    );
    const result = await provider.extractInvoice({ documentBuffer: Buffer.from("synthetic"), mimeType: "image/jpeg", filename: "synthetic.jpg" }) as any;
    assert.equal(result.total, 100000);
    assert.equal(result.items.length, 15);
    assert.equal(result.items[0].description, "Mix Puri");
    assert.equal(result.items[0].quantity, null);
    assert.equal(result.items[0].amount, null);
    assert.equal(result.vendor_name, null);
    assert.equal(result.structuringProvider, "ocr_text_rules");
    assert.match(result.provenance.total.source, /Total Amount/);
    assert.match(result.structuringError, /Groq fallback failed/);
  });

  it("Groq structures OCR text only and rejects values without exact evidence", async () => {
    let requestBody = "";
    let requestHeaders: HeadersInit | undefined;
    const groq = new GroqTextStructurer(
      () => "test-groq-key",
      () => "test-qwen-model",
      async (_url, init) => {
        requestBody = String(init?.body);
        requestHeaders = init?.headers;
        const invalidEvidence = { ...structured, vendor_name: { value: "Fake Vendor", evidence: "not in source" } };
        return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(invalidEvidence) } }] }), { status: 200 });
      },
    );
    const result = await groq.structure(text);
    assert.match(JSON.parse(requestBody).messages[0].content, /OM Caterers/);
    assert.equal(JSON.parse(requestBody).messages[0].content.includes("not sent to Groq"), false);
    assert.equal((requestHeaders as Record<string, string>).Authorization, "Bearer test-groq-key");
    assert.equal(result.vendor_name, null);
    assert.equal(result.total, 100000);
    assert.equal(result.structuringProvider, "groq_text_fallback");
  });
});
