import type { StructuredInvoiceData } from "../extraction/extraction.types";
import type { InvoiceCategory, InvoiceCategorization } from "./categorization.types";
import { CATEGORIZATION_KEYWORDS } from "./categorization.keywords";

/**
 * Deterministic, rule-based invoice categorization service.
 * Uses keyword matching and line-item analysis.
 * NO LLM - pure deterministic logic.
 */
export class CategorizationService {
  /**
   * Categorize an invoice using deterministic keyword matching.
   */
  categorize(input: {
    vendorName: string;
    description?: string;
    lineItems?: Array<{ description: string }>;
  }): InvoiceCategorization {
    const startTime = Date.now();

    // Build the full text to analyze
    const textParts = [
      input.vendorName || "",
      input.description || "",
      ...(input.lineItems?.map((item) => item.description) || [])
    ];
    const fullText = textParts.join(" ").toLowerCase();

    // Score each category
    const categoryScores = this.scoreCategories(fullText);

    // Find the best match
    const topMatch = categoryScores.reduce((prev, curr) => (curr.score > prev.score ? curr : prev));

    // Determine confidence level
    const confidence = Math.min(1, topMatch.score / 100);
    const status = confidence >= 0.75 ? "HIGH_CONFIDENCE" : "LOW_CONFIDENCE";

    const result: InvoiceCategorization = {
      category: topMatch.category,
      confidence,
      reason: topMatch.reason,
      status,
      method: "RULE_BASED",
      matchedSignals: topMatch.signals,
      provider: "DETERMINISTIC",
      model: "KEYWORD_MATCHING_V1",
      categorizedAt: new Date()
    };

    console.info("categorization.completed", {
      category: result.category,
      confidence: result.confidence,
      durationMs: Date.now() - startTime,
      status: result.status
    });

    return result;
  }

  /**
   * Score each category based on keyword matches.
   */
  private scoreCategories(
    text: string
  ): Array<{
    category: InvoiceCategory;
    score: number;
    reason: string;
    signals: string[];
  }> {
    const results: Array<{
      category: InvoiceCategory;
      score: number;
      reason: string;
      signals: string[];
    }> = [];

    for (const [category, keywords] of Object.entries(CATEGORIZATION_KEYWORDS)) {
      const signals: string[] = [];
      let score = 0;

      // Primary keywords (high weight)
      for (const keyword of keywords.primary) {
        if (text.includes(keyword)) {
          score += 20;
          signals.push(`primary: ${keyword}`);
        }
      }

      // Secondary keywords (medium weight)
      for (const keyword of keywords.secondary) {
        if (text.includes(keyword)) {
          score += 10;
          signals.push(`secondary: ${keyword}`);
        }
      }

      // Tertiary keywords (low weight)
      for (const keyword of keywords.tertiary) {
        if (text.includes(keyword)) {
          score += 5;
          signals.push(`tertiary: ${keyword}`);
        }
      }

      // Negative keywords (penalty)
      for (const keyword of keywords.negative) {
        if (text.includes(keyword)) {
          score -= 15;
          signals.push(`negative: ${keyword}`);
        }
      }

      const reason =
        signals.length > 0
          ? `Matched signals: ${signals.slice(0, 3).join(", ")}`
          : "No specific signals matched, default categorization";

      results.push({
        category: category as InvoiceCategory,
        score: Math.max(0, score),
        reason,
        signals
      });
    }

    return results;
  }
}

export const categorizationService = new CategorizationService();
