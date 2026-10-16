import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OCRSpaceError, OCRSpaceProvider, parseInvoiceText, validateInvoiceBytes } from "../ocrSpaceProvider";

const syntheticText = [
  "OM Caterers",
  "Invoice No: OM-TEST-1001",
  "Invoice Date: 16/10/2026",
  "Catering and food services 1000 persons 100000",
  "Subtotal: INR 100000",
  "Grand Total: INR 100000",
].join("\n");
const pdf = Buffer.from("%PDF-1.4 synthetic document");
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const success = (text: string) => new Response(JSON.stringify({
  IsErroredOnProcessing: false,
  OCRExitCode: 1,
  ParsedResults: [{ FileParseExitCode: 1, ParsedText: text }],
}), { status: 200, headers: { "content-type": "application/json" } });

describe("OCR.space upload and parser", () => {
  it("sends the exact uploaded PDF bytes as multipart and returns OCR text for Gemini structuring", async () => {
    let form: FormData | undefined;
    let headers: HeadersInit | undefined;
    const provider = new OCRSpaceProvider("server-only-test-key", "https://api.ocr.space/parse/image", async (_url, init) => {
      form = init?.body as FormData;
      headers = init?.headers;
      return success(syntheticText);
    });
    const result: any = await provider.extractInvoice({ documentBuffer: pdf, mimeType: "application/pdf", filename: "synthetic-om.pdf" });
    const sent = form!.get("file") as File;
    assert.deepEqual(Buffer.from(await sent.arrayBuffer()), pdf);
    assert.equal((headers as Record<string, string>).apikey, "server-only-test-key");
    assert.equal(form!.get("OCREngine"), "2");
    assert.equal(form!.get("isTable"), "true");
    assert.equal(form!.get("apikey"), null);
    assert.equal(result.vendor_name, undefined);
    assert.equal(result.total, undefined);
    assert.equal(result.items, undefined);
    assert.equal(result.rawText, syntheticText);
  });

  it("accepts synthetic PNG and JPEG signatures and rejects empty or malformed uploads", () => {
    validateInvoiceBytes(png, "image/png");
    validateInvoiceBytes(jpeg, "image/jpeg");
    assert.throws(() => validateInvoiceBytes(Buffer.alloc(0), "image/png"), (error: any) => error.code === "EMPTY_FILE");
    assert.throws(() => validateInvoiceBytes(Buffer.from("not a pdf"), "application/pdf"), (error: any) => error.code === "INVALID_FILE_SIGNATURE");
    assert.throws(() => validateInvoiceBytes(png, "text/plain"), (error: any) => error.code === "UNSUPPORTED_FILE_TYPE");
    assert.throws(() => validateInvoiceBytes(Buffer.alloc(1_000_001), "application/pdf"), (error: any) => error.code === "FILE_TOO_LARGE");
  });

  it("leaves missing fields and line items empty with explicit null provenance", () => {
    const parsed: any = parseInvoiceText("OM Caterers\nCatering services supplied");
    assert.equal(parsed.invoice_number, null);
    assert.equal(parsed.total, null);
    assert.deepEqual(parsed.items, []);
    assert.equal(parsed.provenance.total.value, null);
    assert.equal(parsed.provenance.total.source, null);
  });

  it("parses the Indian rupee glyph in totals and catering line items", () => {
    const parsed: any = parseInvoiceText([
      "OM Caterers",
      "Invoice No: OM-TEST-2",
      "Catering services 1000 persons ₹100 ₹1,00,000.00",
      "Grand Total: ₹1,00,000.00",
    ].join("\n"));
    assert.equal(parsed.total, 100000);
    assert.equal(parsed.items[0].quantity, 1000);
    assert.equal(parsed.items[0].unit_price, 100);
    assert.equal(parsed.items[0].amount, 100000);
  });

  it("handles errored, empty, and malformed OCR.space responses as extraction failures", async () => {
    const provider = (body: unknown) => new OCRSpaceProvider("test-key", undefined, async () => new Response(JSON.stringify(body), { status: 200 }));
    await assert.rejects(provider({ IsErroredOnProcessing: true, OCRExitCode: 4, ErrorMessage: "Invalid API key" }).extractInvoice({ documentBuffer: png, mimeType: "image/png", filename: "x.png" }), (error: any) => error.code === "OCR_AUTH_ERROR");
    await assert.rejects(provider({ IsErroredOnProcessing: false, OCRExitCode: 1, ParsedResults: [{ FileParseExitCode: 1, ParsedText: "  " }] }).extractInvoice({ documentBuffer: png, mimeType: "image/png", filename: "x.png" }), (error: any) => error.code === "OCR_EMPTY_TEXT");
    await assert.rejects(provider({ nonsense: true }).extractInvoice({ documentBuffer: png, mimeType: "image/png", filename: "x.png" }), (error: any) => error.code === "OCR_MALFORMED_RESPONSE");
  });

  it("handles OCR rate-limit, API, unavailable, and timeout conditions", async () => {
    const input = { documentBuffer: png, mimeType: "image/png", filename: "x.png" };
    const limited = new OCRSpaceProvider("key", undefined, async () => new Response("{}", { status: 429 }));
    await assert.rejects(limited.extractInvoice(input), (error: any) => error.code === "OCR_RATE_LIMIT");
    const unavailable = new OCRSpaceProvider("key", undefined, async () => new Response("{}", { status: 503 }));
    await assert.rejects(unavailable.extractInvoice(input), (error: any) => error.code === "OCR_UNAVAILABLE");
    const timeout = new OCRSpaceProvider("key", undefined, async (_url, init) => new Promise((_resolve, reject) => init!.signal!.addEventListener("abort", () => reject(new Error("aborted")))), 5);
    await assert.rejects(timeout.extractInvoice(input), (error: any) => error instanceof OCRSpaceError && error.code === "OCR_TIMEOUT");
  });

  it("fails closed when server credentials or the secure endpoint are missing", async () => {
    const input = { documentBuffer: png, mimeType: "image/png", filename: "x.png" };
    await assert.rejects(new OCRSpaceProvider(undefined, undefined, async () => success(syntheticText)).extractInvoice(input), (error: any) => error.code === "OCR_NOT_CONFIGURED");
    await assert.rejects(new OCRSpaceProvider("test-key", "http://ocr.example/parse", async () => success(syntheticText)).extractInvoice(input), (error: any) => error.code === "OCR_CONFIG_ERROR");
  });
});
