import type { InvoiceExtractionProvider } from "./extraction.types";

const MAX_FILE_BYTES = 1_000_000;
const OCR_TIMEOUT_MS = 45_000;

type OCRSpaceResponse = {
  IsErroredOnProcessing?: boolean;
  OCRExitCode?: string | number;
  ErrorMessage?: string | string[] | null;
  ErrorDetails?: string | string[] | null;
  ParsedResults?: Array<{
    FileParseExitCode?: string | number;
    ParsedText?: string | null;
    ErrorMessage?: string | null;
    ErrorDetails?: string | null;
  }>;
};

export class OCRSpaceError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "OCRSpaceError";
  }
}

function safeMime(mime: string): string {
  const allowed: Record<string, string> = {
    "application/pdf": "PDF",
    "image/png": "PNG",
    "image/jpeg": "JPG",
    "image/gif": "GIF",
    "image/tiff": "TIF",
    "image/bmp": "BMP",
  };
  const type = allowed[mime.toLowerCase()];
  if (!type) throw new OCRSpaceError("Unsupported invoice file type. Upload a PDF, PNG, JPEG, GIF, TIFF, or BMP file.", "UNSUPPORTED_FILE_TYPE");
  return type;
}

export function validateInvoiceBytes(bytes: Buffer, mime: string): void {
  if (!bytes.length) throw new OCRSpaceError("The uploaded invoice is empty.", "EMPTY_FILE");
  if (bytes.length > MAX_FILE_BYTES) throw new OCRSpaceError("OCR.space Free accepts files up to 1 MB.", "FILE_TOO_LARGE");
  const type = safeMime(mime);
  const valid = type === "PDF" ? bytes.subarray(0, 5).toString("ascii") === "%PDF-"
    : type === "PNG" ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : type === "JPG" ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : type === "GIF" ? ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"))
    : type === "TIF" ? ["49492a00", "4d4d002a"].includes(bytes.subarray(0, 4).toString("hex"))
    : bytes.subarray(0, 2).toString("ascii") === "BM";
  if (!valid) throw new OCRSpaceError("The uploaded file contents do not match the declared PDF or image type.", "INVALID_FILE_SIGNATURE");
}

function apiFailure(response: OCRSpaceResponse): never {
  const code = Number(response.OCRExitCode);
  if (code === -20) throw new OCRSpaceError("OCR.space timed out while processing this invoice.", "OCR_TIMEOUT");
  const message = [response.ErrorMessage, response.ErrorDetails, ...(response.ParsedResults || []).flatMap((page) => [page.ErrorMessage, page.ErrorDetails])]
    .flat().filter((part): part is string => typeof part === "string" && part.trim().length > 0).join(" ").toLowerCase();
  if (/rate|limit|quota|daily/.test(message)) throw new OCRSpaceError("OCR.space rate limit or quota was reached. Try again later.", "OCR_RATE_LIMIT");
  if (/key|api.?key|unauthori[sz]ed|invalid.?account/.test(message)) throw new OCRSpaceError("OCR.space rejected the configured service credentials.", "OCR_AUTH_ERROR");
  if (/size|large|mb|page limit/.test(message)) throw new OCRSpaceError("OCR.space rejected the document because it exceeds the service limits.", "OCR_LIMIT_ERROR");
  throw new OCRSpaceError("OCR.space could not process this invoice. The upload is retained for review.", code === 3 ? "OCR_PARSE_FAILED" : "OCR_API_ERROR");
}

export class OCRSpaceProvider implements InvoiceExtractionProvider {
  constructor(
    private readonly apiKey = process.env.OCR_SPACE_API_KEY,
    private readonly endpoint = process.env.OCR_SPACE_ENDPOINT || "https://api.ocr.space/parse/image",
    private readonly fetcher: typeof fetch = fetch,
    private readonly timeoutMs = OCR_TIMEOUT_MS,
  ) {}

  async extractInvoice(input: { documentBuffer: Buffer; mimeType: string; filename: string }): Promise<unknown> {
    validateInvoiceBytes(input.documentBuffer, input.mimeType);
    if (!this.apiKey) throw new OCRSpaceError("OCR.space is not configured on the server.", "OCR_NOT_CONFIGURED");
    let endpoint: URL;
    try { endpoint = new URL(this.endpoint); } catch { throw new OCRSpaceError("OCR.space endpoint configuration is invalid.", "OCR_CONFIG_ERROR"); }
    if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new OCRSpaceError("OCR.space endpoint must be a clean HTTPS URL without credentials or query parameters.", "OCR_CONFIG_ERROR");

    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(input.documentBuffer)], { type: input.mimeType }), input.filename.replace(/[\r\n"\\]/g, "_").slice(0, 120));
    form.append("OCREngine", "2");
    form.append("isOverlayRequired", "false");
    form.append("isTable", "true");
    form.append("detectOrientation", "true");
    form.append("scale", "true");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetcher(endpoint, { method: "POST", headers: { apikey: this.apiKey }, body: form, signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted) throw new OCRSpaceError("OCR.space request timed out.", "OCR_TIMEOUT");
      throw new OCRSpaceError("OCR.space is unavailable. The uploaded invoice is retained for review.", "OCR_UNAVAILABLE");
    }

    try {
    if (response.status === 429) throw new OCRSpaceError("OCR.space rate limit was reached. Try again later.", "OCR_RATE_LIMIT");
    if (response.status === 401 || response.status === 403) throw new OCRSpaceError("OCR.space rejected the configured service credentials.", "OCR_AUTH_ERROR");
    if (response.status === 413) throw new OCRSpaceError("OCR.space rejected this document because it exceeds the service size limit.", "OCR_LIMIT_ERROR");
    if (!response.ok) throw new OCRSpaceError(response.status >= 500 ? "OCR.space is temporarily unavailable." : "OCR.space rejected the request.", response.status >= 500 ? "OCR_UNAVAILABLE" : "OCR_API_ERROR");
    const responseLength = Number(response.headers.get("content-length") || 0);
    if (responseLength > 5_000_000) throw new OCRSpaceError("OCR.space response exceeded the safe response size limit.", "OCR_MALFORMED_RESPONSE");
    let payload: OCRSpaceResponse;
    try {
      const responseText = await response.text();
      if (Buffer.byteLength(responseText, "utf8") > 5_000_000) throw new OCRSpaceError("OCR.space response exceeded the safe response size limit.", "OCR_MALFORMED_RESPONSE");
      payload = JSON.parse(responseText) as OCRSpaceResponse;
    }
    catch { if (controller.signal.aborted) throw new OCRSpaceError("OCR.space request timed out.", "OCR_TIMEOUT"); throw new OCRSpaceError("OCR.space returned an invalid response.", "OCR_MALFORMED_RESPONSE"); }
    if (!payload || typeof payload !== "object") throw new OCRSpaceError("OCR.space returned an invalid response structure.", "OCR_MALFORMED_RESPONSE");
    if (payload.IsErroredOnProcessing) apiFailure(payload);
    if (!Array.isArray(payload.ParsedResults)) throw new OCRSpaceError("OCR.space returned an invalid response structure.", "OCR_MALFORMED_RESPONSE");
    if (![1, 2].includes(Number(payload.OCRExitCode))) apiFailure(payload);
    const failedPages = payload.ParsedResults.filter((page) => Number(page.FileParseExitCode) !== 1);
    if (failedPages.length) apiFailure({ ...payload, ErrorMessage: failedPages.map((page) => page.ErrorMessage).filter(Boolean) as string[] });
    const text = payload.ParsedResults.map((page) => page.ParsedText || "").filter(Boolean).join("\n\n").trim();
    if (!text) throw new OCRSpaceError("OCR.space returned no readable text for this invoice.", "OCR_EMPTY_TEXT");
    // OCR.space recognizes document text; Gemini structures invoice fields.
    return { rawText: text };
    } finally { clearTimeout(timeout); }
  }
}

type Evidence = { value: string | number | null; source: string | null; confidence: null };
function findEvidence(lines: string[], pattern: RegExp, parser: (value: string) => string | number | null): Evidence {
  for (const line of lines) {
    const match = line.match(pattern);
    if (match?.[1]) {
      const value = parser(match[1]);
      if (value !== null && value !== "") return { value, source: line.trim(), confidence: null };
    }
  }
  return { value: null, source: null, confidence: null };
}

function amount(value: string): number | null {
  // OCR text may contain the actual rupee glyph; normalize it before parsing digits.
  value = value.replace(new RegExp("\\u20B9", "g"), "");
  const cleaned = value.replace(/₹|Rs\.?|INR/gi, "").replace(/\s/g, "").replace(/,/g, "").replace(/[^\d.-]/g, "");
  if (!cleaned || !/^-?\d+(?:\.\d{1,2})?$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseDate(value: string): string | null {
  const raw = value.trim();
  let parts = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  let iso = parts ? `${parts[1]}-${parts[2]!.padStart(2, "0")}-${parts[3]!.padStart(2, "0")}` : null;
  if (!iso) {
    parts = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (parts) iso = `${parts[3]}-${parts[2]!.padStart(2, "0")}-${parts[1]!.padStart(2, "0")}`;
  }
  if (!iso || Number.isNaN(Date.parse(`${iso}T00:00:00Z`)) || new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) !== iso) return null;
  return iso;
}

export function parseInvoiceText(text: string): Record<string, unknown> {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const invoiceNumber = findEvidence(lines, /(?:invoice\s*(?:no|number|#)|bill\s*(?:no|number|#))\s*[:#-]?\s*([A-Z0-9][A-Z0-9/-]{1,})/i, (v) => v.trim());
  const invoiceDate = findEvidence(lines, /(?:invoice\s*date|bill\s*date|date)\s*[:#-]?\s*(\d{1,4}[-/.]\d{1,2}[-/.]\d{2,4})/i, parseDate);
  const gstin = findEvidence(lines, /(?:GSTIN|GST\s*IN)\s*[:#-]?\s*([0-9A-Z]{15})/i, (v) => v.toUpperCase());
  const poNumber = findEvidence(lines, /(?:purchase\s*order|\bP\.?O\.?\s*(?:no|number|#))\s*[:#-]?\s*([A-Z0-9/-]+)/i, (v) => v.trim());
  const currency = "(?:₹|INR|Rs\\.?)?\\s*";
  const subtotal = findEvidence(lines, new RegExp(`(?:sub\\s*total|taxable\\s*value)\\s*[:\\s-]*${currency}([\\d,]+(?:\\.\\d{1,2})?)`, "i"), amount);
  const tax = findEvidence(lines, new RegExp(`(?:\\bGST\\b|\\bIGST\\b|\\bCGST\\b|\\bSGST\\b|\\btax\\s*amount)\\s*(?:\\([^)]*\\))?\\s*[:\\s-]*(?:\\d+(?:\\.\\d+)?%\\s*)?${currency}([\\d,]+(?:\\.\\d{1,2})?)`, "i"), amount);
  const total = findEvidence(lines, new RegExp(`(?:grand\\s*total|total\\s*amount|amount\\s*payable|invoice\\s*total|net\\s*payable|\\btotal\\b)\\s*[:\\s-]*${currency}([\\d,]+(?:\\.\\d{1,2})?)`, "i"), amount);

  const vendorLine = lines.slice(0, 8).find((line) => /\b(caterers?|catering|foods?|enterprises?|industries|limited|private|pvt|traders?|services|stores?)\b/i.test(line) && !/^\s*(?:tax|invoice|bill)\b/i.test(line));
  const vendor = vendorLine ? { value: vendorLine.replace(/^(?:from|vendor)\s*[:#-]?\s*/i, "").trim(), source: vendorLine, confidence: null } as Evidence : { value: null, source: null, confidence: null };

  const items: Array<{ description: string; quantity: number; unit_price: number; amount: number }> = [];
  const itemEvidence: string[] = [];
  for (const line of lines) {
    if (/\b(sub\s*total|grand\s*total|amount\s*payable|invoice\s*total|tax|gst|round\s*off)\b/i.test(line)) continue;
    const detailed = line.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*(?:persons?|nos?\.?|units?|qty)?\s+(?:₹|INR|Rs\.?\s*)?([\d,]+(?:\.\d{1,2})?)\s+(?:₹|INR|Rs\.?\s*)?([\d,]+(?:\.\d{1,2})?)\s*$/i);
    const simple = line.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*(?:persons?|nos?\.?|units?|qty)\s+(?:[-:]\s*)?(?:₹|INR|Rs\.?\s*)?([\d,]+(?:\.\d{1,2})?)\s*$/i);
    const match = detailed || simple;
    if (!match) continue;
    const qty = amount(match[2]!);
    const totalValue = amount(detailed ? match[4]! : match[3]!);
    const unit = detailed ? amount(match[3]!) : qty && totalValue !== null ? Number((totalValue / qty).toFixed(2)) : null;
    const description = match[1]!.replace(/^[\d.]+\s+/, "").trim();
    if (!description || qty === null || unit === null || totalValue === null) continue;
    items.push({ description, quantity: qty, unit_price: unit, amount: totalValue });
    itemEvidence.push(line);
  }
  const lineDescription = items.length ? items.map((item) => item.description).join("; ") : null;
  const itemEvidenceFallback = lineDescription ? itemEvidence.join("\n") : null;
  const subtotalValue = subtotal.value;
  const totalValue = total.value;
  const taxValue = tax.value ?? (typeof subtotalValue === "number" && typeof totalValue === "number" && totalValue >= subtotalValue ? Number((totalValue - subtotalValue).toFixed(2)) : null);
  const hasDerivedUnitPrice = itemEvidence.some((line) => !/^.+?\s+\d+(?:\.\d+)?\s*(?:persons?|nos?\.?|units?|qty)?\s+(?:₹|INR|Rs\.?\s*)?[\d,]+(?:\.\d{1,2})?\s+(?:₹|INR|Rs\.?\s*)?[\d,]+(?:\.\d{1,2})?\s*$/i.test(line));
  const provenance = {
    invoiceNumber, invoiceDate, vendorName: vendor, gstin, poNumber, subtotal,
    tax: { ...tax, value: taxValue, source: tax.source || (taxValue !== null ? "Derived from OCR subtotal and total lines" : null) },
    total,
    items: itemEvidenceFallback ? {
      value: items,
      source: itemEvidenceFallback,
      confidence: null,
      unitPriceDerivation: hasDerivedUnitPrice ? "line amount divided by printed quantity where no unit rate was printed" : undefined,
    } : { value: null, source: null, confidence: null },
  };
  return {
    invoice_number: invoiceNumber.value,
    invoice_date: invoiceDate.value,
    vendor_name: vendor.value,
    gstin: gstin.value,
    po_number: poNumber.value,
    subtotal: subtotal.value,
    tax: taxValue,
    total: total.value,
    due_date: null,
    items,
    rawText: text,
    provenance,
  };
}

export const ocrSpaceProvider = new OCRSpaceProvider();
