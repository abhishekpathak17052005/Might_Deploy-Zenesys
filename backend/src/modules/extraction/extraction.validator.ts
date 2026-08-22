import { GSTIN_FORMAT, MONEY_TOLERANCE } from "./extraction.constants";
import type { ExtractionValidationFinding, ExtractionValidationResult, StructuredInvoiceData } from "./extraction.types";

function moneyDiff(expected: number, actual: number): number {
  return Number(Math.abs(expected - actual).toFixed(2));
}

function moneyMatches(expected: number, actual: number): boolean {
  return moneyDiff(expected, actual) <= MONEY_TOLERANCE;
}

function addNegativeFinding(
  findings: ExtractionValidationFinding[],
  field: string,
  value: number
): void {
  if (value < 0) {
    findings.push({
      type: "NEGATIVE_VALUE",
      field,
      message: `${field} cannot be negative`,
      actual: value
    });
  }
}

export function validateExtractedInvoiceMath(invoice: StructuredInvoiceData): ExtractionValidationResult {
  const findings: ExtractionValidationFinding[] = [];

  invoice.items.forEach((item, index) => {
    addNegativeFinding(findings, `items.${index}.quantity`, item.quantity);
    addNegativeFinding(findings, `items.${index}.unitPrice`, item.unitPrice);
    addNegativeFinding(findings, `items.${index}.amount`, item.amount);

    const expected = item.quantity * item.unitPrice;
    if (!moneyMatches(expected, item.amount)) {
      findings.push({
        type: "LINE_ITEM_AMOUNT_MISMATCH",
        field: `items.${index}.amount`,
        message: "Line item amount does not equal quantity multiplied by unit price",
        expected,
        actual: item.amount,
        difference: moneyDiff(expected, item.amount),
        evidence: {
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          description: item.description
        }
      });
    }
  });

  addNegativeFinding(findings, "subtotal", invoice.subtotal);
  addNegativeFinding(findings, "tax", invoice.tax);
  addNegativeFinding(findings, "total", invoice.total);

  const expectedSubtotal = invoice.items.reduce((sum, item) => sum + item.amount, 0);
  if (!moneyMatches(expectedSubtotal, invoice.subtotal)) {
    findings.push({
      type: "SUBTOTAL_MISMATCH",
      field: "subtotal",
      message: "Subtotal does not equal the sum of line item amounts",
      expected: expectedSubtotal,
      actual: invoice.subtotal,
      difference: moneyDiff(expectedSubtotal, invoice.subtotal)
    });
  }

  const expectedTotal = invoice.subtotal + invoice.tax;
  if (!moneyMatches(expectedTotal, invoice.total)) {
    findings.push({
      type: "TOTAL_MISMATCH",
      field: "total",
      message: "Total does not equal subtotal plus tax",
      expected: expectedTotal,
      actual: invoice.total,
      difference: moneyDiff(expectedTotal, invoice.total)
    });
  }

  if (invoice.gstin && !GSTIN_FORMAT.test(invoice.gstin)) {
    findings.push({
      type: "GSTIN_FORMAT_INVALID",
      field: "gstin",
      message: "GSTIN does not match the expected format",
      actual: invoice.gstin
    });
  }

  return {
    status: findings.length === 0 ? "VALID" : "INVALID",
    findings
  };
}
