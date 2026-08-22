import { GEMINI_API_ENDPOINT, EXTRACTION_MODEL } from "./extraction.constants";
import type { InvoiceExtractionProvider } from "./extraction.types";

export class GeminiExtractionProvider implements InvoiceExtractionProvider {
  constructor(
    private readonly apiKey: string | undefined = process.env.GEMINI_API_KEY,
    private readonly model: string = EXTRACTION_MODEL
  ) {}

  async extractInvoice(input: {
    documentBuffer: Buffer;
    mimeType: string;
    filename: string;
  }): Promise<unknown> {
    if (!this.apiKey) {
      throw new Error("Gemini extraction provider is not configured");
    }

    const response = await fetch(`${GEMINI_API_ENDPOINT}/${this.model}:generateContent?key=${this.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: [
                  "Extract this invoice into strict JSON only.",
                  "Use snake_case keys: invoice_number, invoice_date, vendor_name, gstin, po_number, subtotal, tax, total, due_date, items.",
                  "Dates must be YYYY-MM-DD. Amounts and quantities must be numbers.",
                  "For important scalar fields, return either the scalar value or {\"value\":...,\"confidence\":0..1}.",
                  "Items must contain description, quantity, unit_price, tax_rate, amount.",
                  `Filename: ${input.filename}`
                ].join("\n")
              },
              {
                inlineData: {
                  mimeType: input.mimeType,
                  data: input.documentBuffer.toString("base64")
                }
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini extraction request failed with status ${response.status}`);
    }

    const payload = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;

    if (!text) {
      throw new Error("Gemini extraction returned no JSON text");
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Gemini extraction returned malformed JSON");
    }
  }
}

export const geminiExtractionProvider = new GeminiExtractionProvider();
