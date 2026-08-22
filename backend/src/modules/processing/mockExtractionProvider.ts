import type { InvoiceExtractionProvider } from "../extraction";

export class JsonBufferExtractionProvider implements InvoiceExtractionProvider {
  async extractInvoice(input: { documentBuffer: Buffer }): Promise<unknown> {
    const text = input.documentBuffer.toString("utf8");
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new Error("Mock extraction document contains malformed JSON.");
    }
  }
}
