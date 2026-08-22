import type { InvoiceCategorizationProvider } from "../categorization";

export class KeywordCategorizationProvider implements InvoiceCategorizationProvider {
  async categorizeInvoice(input: { vendorName: string; itemDescriptions: string[] }): Promise<unknown> {
    const text = `${input.vendorName} ${input.itemDescriptions.join(" ")}`.toLowerCase();

    if (text.includes("software") || text.includes("saas") || text.includes("subscription")) {
      return { category: "Software / SaaS", confidence: 0.92, reason: "Software subscription keywords matched." };
    }

    if (text.includes("travel") || text.includes("hotel") || text.includes("flight")) {
      return { category: "Travel", confidence: 0.9, reason: "Travel expense keywords matched." };
    }

    if (text.includes("professional")) {
      return { category: "Professional Services", confidence: 0.88, reason: "Professional services keywords matched." };
    }

    if (text.includes("marketing") || text.includes("campaign")) {
      return { category: "Marketing", confidence: 0.91, reason: "Marketing service keywords matched." };
    }

    if (text.includes("utility") || text.includes("electricity") || text.includes("water")) {
      return { category: "Utilities", confidence: 0.9, reason: "Utility keywords matched." };
    }

    if (text.includes("maintenance") || text.includes("repair")) {
      return { category: "Maintenance", confidence: 0.9, reason: "Maintenance keywords matched." };
    }

    if (text.includes("office")) {
      return { category: "Office Supplies", confidence: 0.86, reason: "Office supplies keywords matched." };
    }

    if (text.includes("laptop") || text.includes("dock") || text.includes("it supplies")) {
      return { category: "IT Equipment", confidence: 0.93, reason: "IT equipment keywords matched." };
    }

    return { category: "Other", confidence: 0.5, reason: "No deterministic category keyword matched." };
  }
}
