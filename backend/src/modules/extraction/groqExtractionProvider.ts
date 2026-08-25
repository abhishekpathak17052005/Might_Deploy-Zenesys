import Groq from "groq-sdk";
import { GROQ_DEFAULT_EXTRACTION_MODEL } from "./extraction.constants";
import type { InvoiceExtractionProvider } from "./extraction.types";

export class GroqExtractionProvider implements InvoiceExtractionProvider {
  private groq: Groq;

  constructor(
    private readonly apiKey: string | undefined = process.env.GROQ_API_KEY,
    private readonly model: string = GROQ_DEFAULT_EXTRACTION_MODEL
  ) {
    this.groq = new Groq({ apiKey: this.apiKey || "dummy" }); // Will throw later if not actually set but required
  }

  async extractInvoice(input: {
    documentBuffer: Buffer;
    mimeType: string;
    filename: string;
  }): Promise<unknown> {
    if (!this.apiKey) {
      throw new Error("Groq extraction provider is not configured");
    }

    const base64Data = input.documentBuffer.toString("base64");
    const dataUrl = `data:${input.mimeType};base64,${base64Data}`;

    const promptText = [
      "Extract this invoice into strict JSON only.",
      "Use snake_case keys: invoice_number, invoice_date, vendor_name, gstin, po_number, subtotal, tax, total, due_date, items.",
      "Dates must be YYYY-MM-DD. Amounts and quantities must be numbers.",
      "For important scalar fields, return either the scalar value or {\"value\":...,\"confidence\":0..1}.",
      "Items must contain description, quantity, unit_price, tax_rate, amount.",
      `Filename: ${input.filename}`
    ].join("\n");

    const response = await this.groq.chat.completions.create({
      model: this.model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: promptText },
            {
              type: "image_url",
              image_url: { url: dataUrl },
            },
          ],
        },
      ],
      temperature: 0,
    });

    const text = response.choices[0]?.message?.content;

    if (!text) {
      throw new Error("Groq extraction returned no content");
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Groq extraction returned malformed JSON");
    }
  }
}

export const groqExtractionProvider = new GroqExtractionProvider();
