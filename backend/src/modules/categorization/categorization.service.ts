import { categorizationResponseSchema, allowedCategorySchema } from "./categorization.schemas";
import { geminiCategorizationProvider } from "./geminiCategorizationProvider";
import type { InvoiceCategorization, InvoiceCategorizationProvider } from "./categorization.types";
import type { StructuredInvoiceData } from "../extraction";

export class CategorizationService {
  constructor(private readonly provider: InvoiceCategorizationProvider = geminiCategorizationProvider) {}

  async categorize(invoice: StructuredInvoiceData): Promise<InvoiceCategorization> {
    const raw = await this.provider.categorizeInvoice({
      vendorName: invoice.vendorName,
      itemDescriptions: invoice.items.map((item) => item.description)
    });

    return this.normalize(raw);
  }

  normalize(raw: unknown): InvoiceCategorization {
    const parsed = categorizationResponseSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        category: "Other",
        confidence: 0,
        reason: "Categorization response was malformed.",
        status: "FAILED",
        provider: "gemini",
        model: process.env.GEMINI_CATEGORIZATION_MODEL ?? process.env.GEMINI_EXTRACTION_MODEL ?? "gemini-1.5-flash",
        categorizedAt: new Date()
      };
    }

    const categoryResult = allowedCategorySchema.safeParse(parsed.data.category);
    const category = categoryResult.success ? categoryResult.data : "Other";
    const status = parsed.data.confidence >= 0.75 ? "HIGH_CONFIDENCE" : "LOW_CONFIDENCE";

    return {
      category,
      confidence: parsed.data.confidence,
      reason: categoryResult.success
        ? parsed.data.reason
        : `Gemini returned unsupported category "${parsed.data.category}". Mapped to Other.`,
      status,
      provider: "gemini",
      model: process.env.GEMINI_CATEGORIZATION_MODEL ?? process.env.GEMINI_EXTRACTION_MODEL ?? "gemini-1.5-flash",
      categorizedAt: new Date()
    };
  }
}

export const categorizationService = new CategorizationService();
