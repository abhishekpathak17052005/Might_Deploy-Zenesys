import { GEMINI_API_ENDPOINT, EXTRACTION_MODEL } from "../extraction/extraction.constants";
import { ALLOWED_INVOICE_CATEGORIES, type InvoiceCategorizationProvider } from "./categorization.types";

export class GeminiCategorizationProvider implements InvoiceCategorizationProvider {
  constructor(
    private readonly apiKey: string | undefined = process.env.GEMINI_API_KEY,
    private readonly model: string = process.env.GEMINI_CATEGORIZATION_MODEL ?? EXTRACTION_MODEL
  ) {}

  async categorizeInvoice(input: {
    vendorName: string;
    itemDescriptions: string[];
  }): Promise<unknown> {
    if (!this.apiKey) {
      throw new Error("Gemini categorization provider is not configured");
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
                  "Categorize this invoice expense. This is not risk analysis.",
                  `Allowed categories: ${ALLOWED_INVOICE_CATEGORIES.join(", ")}`,
                  "Return strict JSON only: {\"category\":\"...\",\"confidence\":0..1,\"reason\":\"...\"}.",
                  `Vendor: ${input.vendorName}`,
                  `Items: ${input.itemDescriptions.join(", ")}`
                ].join("\n")
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini categorization request failed with status ${response.status}`);
    }

    const payload = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;
    if (!text) {
      throw new Error("Gemini categorization returned no JSON text");
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Gemini categorization returned malformed JSON");
    }
  }
}

export const geminiCategorizationProvider = new GeminiCategorizationProvider();
