/**
 * Recover a printed invoice total when a text structurer omits it. This is
 * deliberately label anchored and keeps the exact OCR lines as provenance.
 */
export function extractLabelledTotal(ocrText: string): { value: number; evidence: string } | null {
  const lines = ocrText.split(/\r?\n/);
  const label = /\b(?:grand\s+total|total\s+amount|invoice\s+total|net\s+payable|amount\s+due|total\s+payable)\b/i;
  const amount = /(?:\u20B9|Rs\.?|INR)?\s*([0-9]{1,3}(?:,[0-9]{2,3})+|[0-9]+)(?:\.([0-9]{1,2}))?\s*(?:\/-|\/\-)?/i;

  for (let index = 0; index < lines.length; index += 1) {
    if (!label.test(lines[index] || "")) continue;

    // Table OCR often puts the label and its value on adjacent lines/cells.
    // Search only the same line and the next two lines, stopping at another
    // labelled amount field to avoid borrowing a nearby subtotal or tax.
    const window = [lines[index] || ""];
    for (let offset = 1; offset <= 2 && index + offset < lines.length; offset += 1) {
      const next = lines[index + offset] || "";
      if (/\b(?:sub\s*total|taxable\s+value|\b(?:cgst|sgst|igst|gst)\b|amount\s+in\s+words)\b/i.test(next)) break;
      window.push(next);
    }

    const evidence = window.join("\n").trim();
    const match = evidence.match(amount);
    if (!match) continue;
    const value = Number(`${match[1]!.replace(/,/g, "")}${match[2] ? `.${match[2]}` : ""}`);
    if (Number.isFinite(value) && value > 0) return { value, evidence };
  }
  return null;
}

export function attachLabelledTotal<T extends Record<string, unknown>>(result: T, ocrText: string): T {
  if (typeof result.total === "number" && result.total > 0) return result;
  const extracted = extractLabelledTotal(ocrText);
  if (!extracted) return result;

  const provenance = result.provenance && typeof result.provenance === "object"
    ? result.provenance as Record<string, unknown>
    : {};
  return {
    ...result,
    total: extracted.value,
    provenance: {
      ...provenance,
      total: { value: extracted.value, source: extracted.evidence, confidence: null },
    },
    structuringFallbackReason: result.structuringFallbackReason || "Total recovered from an explicit total label in OCR text",
  };
}

/** Extract table descriptions only from an explicitly titled details section. */
export function extractNumberedLineItems(ocrText: string): Array<{ description: string; quantity: null; unit_price: null; amount: null; evidence: string }> {
  const lines = ocrText.split(/\r?\n/);
  const start = lines.findIndex((line) => /^\s*(?:catering\s+details|invoice\s+details|line\s+items|particulars)\b/i.test(line));
  if (start < 0) return [];
  const end = lines.findIndex((line, index) => index > start && /\b(?:grand\s+total|total\s+amount|invoice\s+total|amount\s+due|total\s+payable)\b/i.test(line));
  const section = lines.slice(start + 1, end < 0 ? undefined : end);
  const items: Array<{ description: string; quantity: null; unit_price: null; amount: null; evidence: string }> = [];
  for (const line of section) {
    const match = line.match(/^\s*(\d{1,2})[.)]?\s+([A-Za-z0-9][\w&()/',+ -]{1,100}?)\s*$/);
    if (!match) continue;
    const description = match[2]!.trim();
    if (/^(?:no\.?|particulars|description)$/i.test(description)) continue;
    items.push({ description, quantity: null, unit_price: null, amount: null, evidence: line.trim() });
  }
  return items;
}

/** Apply only direct, source-backed OCR evidence after AI structurers fail or omit data. */
export function applyOcrEvidenceFallback<T extends Record<string, unknown>>(result: T, ocrText: string): T {
  const withTotal = attachLabelledTotal(result, ocrText);
  const existingItems = Array.isArray(withTotal.items) ? withTotal.items : [];
  const parsedItems = existingItems.length ? [] : extractNumberedLineItems(ocrText);
  const recoveredTotal = typeof withTotal.total === "number" && withTotal.total > 0;
  if (!parsedItems.length && !recoveredTotal) return withTotal;

  const provenance = withTotal.provenance && typeof withTotal.provenance === "object"
    ? withTotal.provenance as Record<string, unknown>
    : {};
  const priorSource = provenance.items && typeof provenance.items === "object"
    ? provenance.items as Record<string, unknown>
    : {};
  return {
    ...withTotal,
    items: parsedItems.length ? parsedItems.map(({ description, quantity, unit_price, amount }) => ({ description, quantity, unit_price, amount })) : existingItems,
    provenance: {
      ...provenance,
      ...(parsedItems.length ? { items: { value: parsedItems, source: parsedItems.map((item) => item.evidence).join("\n"), confidence: null } } : { items: priorSource }),
    },
    structuringProvider: (withTotal.structuringProvider === "gemini_failed" || withTotal.structuringProvider === "groq_failed") ? "ocr_text_rules" : withTotal.structuringProvider,
    structuringFallbackReason: withTotal.structuringFallbackReason || "Fields recovered from explicit labels and numbered rows in OCR text",
  };
}
