import type { StructuredInvoiceData } from "../extraction/extraction.types";
import type { InvoiceCategory, InvoiceCategorization } from "./categorization.types";
import { CATEGORIZATION_KEYWORDS } from "./categorization.keywords";

/**
 * Deterministic, rule-based invoice categorization service.
 * Uses keyword matching and line-item analysis.
 * NO LLM - pure deterministic logic.
 */
export class CategorizationService {
  constructor(_provider?: unknown) {}

  /**
   * Categorize an invoice using deterministic keyword matching.
   */
  categorize(input: {
    vendorName: string;
    description?: string;
    lineItems?: Array<{ description: string }>;
    items?: Array<{ description: string }>;
  }): InvoiceCategorization {
    const startTime = Date.now();

    // Build the full text to analyze
    const itemsList = input.lineItems || input.items || [];
    const textParts = [
      input.vendorName || "",
      input.description || "",
      ...itemsList.map((item) => item.description || "")
    ];
    const fullText = textParts.join(" ").toLowerCase();

    // Score each category
    const categoryScores = this.scoreCategories(fullText);

    // Find the best match
    const topMatch = categoryScores.reduce((prev, curr) => (curr.score > prev.score ? curr : prev));
    const hasPrimary = topMatch.signals.some((s) => s.startsWith("primary"));
    const hasSecondary = topMatch.signals.some((s) => s.startsWith("secondary"));
    const hasNegative = topMatch.signals.some((s) => s.startsWith("negative"));

    if (topMatch.score === 0 || (!hasPrimary && !hasSecondary)) {
      topMatch.category = "Other";
      topMatch.reason = "No specific signals matched, default categorization";
    }

    // Determine confidence level
    let confidence = 0;
    if (topMatch.category !== "Other" && topMatch.score > 0) {
      if (hasPrimary && !hasNegative) {
        confidence = Math.min(1, 0.75 + (topMatch.score / 100) * 0.25);
      } else {
        confidence = Math.min(0.65, Math.max(0.2, topMatch.score / 100));
      }
    }
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

    const matchesKeyword = (keyword: string) => {
      if (keyword.length <= 3) {
        const regex = new RegExp(`\\b${keyword}\\b`, "i");
        return regex.test(text);
      }
      return text.includes(keyword);
    };

    for (const [category, keywords] of Object.entries(CATEGORIZATION_KEYWORDS)) {
      const signals: string[] = [];
      let score = 0;

      // Primary keywords (high weight)
      for (const keyword of keywords.primary) {
        if (matchesKeyword(keyword)) {
          score += 20;
          signals.push(`primary: ${keyword}`);
        }
      }

      // Secondary keywords (medium weight)
      for (const keyword of keywords.secondary) {
        if (matchesKeyword(keyword)) {
          score += 10;
          signals.push(`secondary: ${keyword}`);
        }
      }

      // Tertiary keywords (low weight)
      for (const keyword of keywords.tertiary) {
        if (matchesKeyword(keyword)) {
          score += 5;
          signals.push(`tertiary: ${keyword}`);
        }
      }

      // Negative keywords (penalty)
      for (const keyword of keywords.negative) {
        if (matchesKeyword(keyword)) {
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
