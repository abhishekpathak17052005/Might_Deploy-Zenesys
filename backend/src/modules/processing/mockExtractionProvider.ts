import type { InvoiceExtractionProvider } from "../extraction";
import { geminiExtractionProvider } from "../extraction/geminiExtractionProvider";

export class JsonBufferExtractionProvider implements InvoiceExtractionProvider {
  async extractInvoice(input: { documentBuffer: Buffer; mimeType?: string; filename?: string }): Promise<unknown> {
    const text = input.documentBuffer.toString("utf8");
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return geminiExtractionProvider.extractInvoice({
        documentBuffer: input.documentBuffer,
        mimeType: input.mimeType || "application/pdf",
        filename: input.filename || "invoice.pdf"
      });
    }
  }
}
