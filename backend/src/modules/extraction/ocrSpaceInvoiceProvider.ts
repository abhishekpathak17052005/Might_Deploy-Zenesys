import type { InvoiceExtractionProvider } from "./extraction.types";
import { OCRSpaceProvider } from "./ocrSpaceProvider";
import { GeminiTextStructurer, geminiTextStructurer } from "./geminiTextStructurer";
import { GroqTextStructurer, groqTextStructurer } from "./groqTextStructurer";
import { applyOcrEvidenceFallback } from "./ocrTotalEvidence";

type Structurer = Pick<{ structure: (ocrText: string) => Promise<any> }, "structure">;

function completenessScore(result: Record<string, unknown>): number {
  const items = Array.isArray(result.items) ? result.items.filter((item: any) => typeof item?.description === "string" && item.description.trim()) : [];
  return (typeof result.total === "number" && result.total > 0 ? 10 : 0)
    + (typeof result.subtotal === "number" && result.subtotal > 0 ? 4 : 0)
    + (typeof result.tax === "number" && result.tax >= 0 ? 2 : 0)
    + Math.min(items.length, 20)
    + (typeof result.invoice_number === "string" && result.invoice_number ? 1 : 0)
    + (typeof result.invoice_date === "string" && result.invoice_date ? 1 : 0)
    + (typeof result.vendor_name === "string" && result.vendor_name ? 1 : 0);
}

export class OCRSpaceInvoiceProvider implements InvoiceExtractionProvider {
  private readonly primaryStructurer: Structurer;
  private readonly fallbackStructurer: Structurer;
  private readonly defaultPrimaryName: "Groq" | "Gemini";
  private readonly defaultFallbackName: "Groq" | "Gemini";

  constructor(
    private readonly ocr: InvoiceExtractionProvider = new OCRSpaceProvider(),
    structurer?: Structurer,
    fallbackStructurer?: Structurer,
  ) {
    const isGroqPrimary = (process.env.PRIMARY_STRUCTURER || "groq").toLowerCase() !== "gemini";

    if (structurer && fallbackStructurer) {
      this.primaryStructurer = structurer;
      this.fallbackStructurer = fallbackStructurer;
      this.defaultPrimaryName = isGroqPrimary ? "Groq" : "Gemini";
      this.defaultFallbackName = isGroqPrimary ? "Gemini" : "Groq";
    } else if (structurer) {
      this.primaryStructurer = structurer;
      this.fallbackStructurer = fallbackStructurer ?? (isGroqPrimary ? geminiTextStructurer : groqTextStructurer);
      this.defaultPrimaryName = isGroqPrimary ? "Groq" : "Gemini";
      this.defaultFallbackName = isGroqPrimary ? "Gemini" : "Groq";
    } else {
      if (isGroqPrimary) {
        this.primaryStructurer = groqTextStructurer;
        this.fallbackStructurer = geminiTextStructurer;
        this.defaultPrimaryName = "Groq";
        this.defaultFallbackName = "Gemini";
      } else {
        this.primaryStructurer = geminiTextStructurer;
        this.fallbackStructurer = groqTextStructurer;
        this.defaultPrimaryName = "Gemini";
        this.defaultFallbackName = "Groq";
      }
    }
  }

  async extractInvoice(input: { documentBuffer: Buffer; mimeType: string; filename: string }): Promise<unknown> {
    const ocrResult = await this.ocr.extractInvoice(input) as Record<string, unknown>;
    const text = typeof ocrResult.rawText === "string" ? ocrResult.rawText : "";

    try {
      const primaryRaw = await this.primaryStructurer.structure(text);
      const primaryResult = applyOcrEvidenceFallback(primaryRaw, text);
      const items = Array.isArray(primaryResult.items) ? primaryResult.items : [];
      const hasSupportedTotal = typeof primaryResult.total === "number" && primaryResult.total > 0;

      if (hasSupportedTotal && items.length > 0) {
        return {
          ...primaryResult,
          structuringProvider: primaryResult.structuringProvider === "groq_text_fallback" && this.defaultPrimaryName === "Groq"
            ? "groq"
            : primaryResult.structuringProvider,
        };
      }

      const primaryLabel = this.detectLabel(primaryRaw?.structuringProvider) || this.defaultPrimaryName;
      const fallbackLabel = primaryLabel === "Groq" ? "Gemini" : "Groq";

      try {
        const fallbackRaw = await this.fallbackStructurer.structure(text);
        const fallbackResult = applyOcrEvidenceFallback(fallbackRaw, text);

        if (completenessScore(fallbackResult) > completenessScore(primaryResult)) {
          return { ...fallbackResult, structuringFallbackReason: `${primaryLabel} returned incomplete invoice fields` };
        }
        return applyOcrEvidenceFallback({
          ...primaryResult,
          structuringError: `${primaryLabel} did not find a supported invoice total or complete line details, and ${fallbackLabel} found no additional OCR-supported fields.`,
        }, text);
      } catch (fallbackError) {
        const fallbackErrMsg = fallbackError instanceof Error ? fallbackError.message : `${fallbackLabel} text structuring failed.`;
        return applyOcrEvidenceFallback({
          ...primaryResult,
          structuringError: `${primaryLabel} returned incomplete invoice fields; ${fallbackLabel} fallback failed: ${fallbackErrMsg}`,
        }, text);
      }
    } catch (error) {
      const primaryError = error instanceof Error ? error.message : "Text structuring failed.";
      const primaryLabel = /gemini/i.test(primaryError) ? "Gemini" : /groq/i.test(primaryError) ? "Groq" : this.defaultPrimaryName;
      const fallbackLabel = primaryLabel === "Gemini" ? "Groq" : "Gemini";

      const transientFailure = /is temporarily unavailable or overloaded after retries|timed out|request failed \(HTTP 5\d\d\)|rate limit or quota reached/i.test(primaryError)
        || /fetch failed|network error|ECONNRESET|ETIMEDOUT/i.test(primaryError);

      if (transientFailure) {
        try {
          const fallback = applyOcrEvidenceFallback(await this.fallbackStructurer.structure(text), text);
          return { ...fallback, structuringFallbackReason: `${primaryLabel} temporarily unavailable after retries` };
        } catch (fallbackError) {
          const fallbackErrMsg = fallbackError instanceof Error ? fallbackError.message : `${fallbackLabel} text structuring failed.`;
          return applyOcrEvidenceFallback(this.failedResult(text, `${primaryLabel} was temporarily unavailable; ${fallbackLabel} fallback failed: ${fallbackErrMsg}`, `${primaryLabel.toLowerCase()}_failed`), text);
        }
      }

      return applyOcrEvidenceFallback(this.failedResult(text, primaryError, `${primaryLabel.toLowerCase()}_failed`), text);
    }
  }

  private detectLabel(provider: unknown): "Groq" | "Gemini" | null {
    if (typeof provider !== "string") return null;
    if (/groq/i.test(provider)) return "Groq";
    if (/gemini/i.test(provider)) return "Gemini";
    return null;
  }

  private failedResult(text: string, structuringError: string, provider = "extraction_failed"): Record<string, unknown> {
    return {
      invoice_number: null,
      invoice_date: null,
      vendor_name: null,
      gstin: null,
      po_number: null,
      subtotal: null,
      tax: null,
      total: null,
      due_date: null,
      items: [],
      rawText: text,
      provenance: {},
      structuringProvider: provider,
      structuringError,
    };
  }
}

export const ocrSpaceInvoiceProvider = new OCRSpaceInvoiceProvider();
