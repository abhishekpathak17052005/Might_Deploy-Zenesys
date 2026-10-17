import { GSTIN_FORMAT, MONEY_TOLERANCE } from "./extraction.constants";
import type {
  ExtractionValidationFinding,
  ExtractionValidationResult,
  ReconciliationStatus,
  StructuredInvoiceData
} from "./extraction.types";

function moneyDiff(expected: number, actual: number): number {
  return Number(Math.abs(expected - actual).toFixed(2));
}

function moneyMatches(expected: number, actual: number): boolean {
  return moneyDiff(expected, actual) <= MONEY_TOLERANCE;
}

function addNegativeFinding(
  findings: ExtractionValidationFinding[],
  field: string,
  value: number | null | undefined
): void {
  if (typeof value === "number" && value < 0) {
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
    if (item.quantity !== null) addNegativeFinding(findings, `items.${index}.quantity`, item.quantity);
    if (item.unitPrice !== null) addNegativeFinding(findings, `items.${index}.unitPrice`, item.unitPrice);
    if (item.amount !== null) addNegativeFinding(findings, `items.${index}.amount`, item.amount);

    if (item.quantity !== null && item.unitPrice !== null && item.amount !== null) {
      const expected = Number((item.quantity * item.unitPrice).toFixed(2));
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
    }
  });

  addNegativeFinding(findings, "subtotal", invoice.subtotal);
  addNegativeFinding(findings, "tax", invoice.tax);
  addNegativeFinding(findings, "total", invoice.total);
  if (invoice.discount !== undefined) addNegativeFinding(findings, "discount", invoice.discount);
  if (invoice.shipping !== undefined) addNegativeFinding(findings, "shipping", invoice.shipping);

  const allItemAmountsKnown = invoice.items.length > 0 && invoice.items.every((item) => typeof item.amount === "number" && item.amount !== null);
  const expectedSubtotal = allItemAmountsKnown
    ? Number(invoice.items.reduce((sum, item) => sum + (item.amount ?? 0), 0).toFixed(2))
    : null;
  if (
    expectedSubtotal !== null &&
    typeof invoice.subtotal === "number" &&
    invoice.subtotal > 0 &&
    !moneyMatches(expectedSubtotal, invoice.subtotal)
  ) {
    findings.push({
      type: "SUBTOTAL_MISMATCH",
      field: "subtotal",
      message: "Subtotal does not equal the sum of line item amounts",
      expected: expectedSubtotal,
      actual: invoice.subtotal,
      difference: moneyDiff(expectedSubtotal, invoice.subtotal)
    });
  }

  // Reconciliation: check whether all required financial fields are reliably established.
  const hasSubtotal = typeof invoice.subtotal === "number" && Number.isFinite(invoice.subtotal) && invoice.subtotal > 0;
  const hasTax = typeof invoice.tax === "number" && Number.isFinite(invoice.tax) && invoice.tax >= 0;
  const hasTotal = typeof invoice.total === "number" && Number.isFinite(invoice.total) && invoice.total > 0;

  let reconciliationStatus: ReconciliationStatus = "RECONCILED";
  let reconciliationMessage = "Invoice amounts reconciled successfully within tolerance.";

  if (!hasTotal) {
    reconciliationStatus = "REVIEW_REQUIRED";
    reconciliationMessage = "Invoice total is missing or unverified from source evidence.";
    findings.push({
      type: "MISSING_TOTAL",
      field: "total",
      message: "Invoice total is missing or could not be verified from source evidence."
    });
  }

  if (!hasSubtotal) {
    if (reconciliationStatus === "RECONCILED") {
      reconciliationStatus = "INCOMPLETE";
      reconciliationMessage = "Invoice subtotal is missing or not established from source evidence.";
    }
    findings.push({
      type: "MISSING_SUBTOTAL",
      field: "subtotal",
      message: "Invoice subtotal is missing or not established from source evidence."
    });
  }

  if (!hasTax) {
    if (reconciliationStatus === "RECONCILED") {
      reconciliationStatus = "INCOMPLETE";
      reconciliationMessage = "Tax amount is missing or not established from source evidence.";
    }
    findings.push({
      type: "MISSING_TAX",
      field: "tax",
      message: "Tax amount is missing or not established from source evidence."
    });
  }

  // Only compare subtotal + tax against grand total when all required values are present and verified.
  if (hasSubtotal && hasTax && hasTotal) {
    const discount = typeof invoice.discount === "number" && Number.isFinite(invoice.discount) ? invoice.discount : 0;
    const shipping = typeof invoice.shipping === "number" && Number.isFinite(invoice.shipping) ? invoice.shipping : 0;
    const adjustments = typeof invoice.adjustments === "number" && Number.isFinite(invoice.adjustments) ? invoice.adjustments : 0;

    const expectedTotal = Number((invoice.subtotal! + invoice.tax! - discount + shipping + adjustments).toFixed(2));
    if (!moneyMatches(expectedTotal, invoice.total!)) {
      reconciliationStatus = "MISMATCH";
      reconciliationMessage = "Total does not equal subtotal plus tax";
      findings.push({
        type: "TOTAL_MISMATCH",
        field: "total",
        message: "Total does not equal subtotal plus tax",
        expected: expectedTotal,
        actual: invoice.total!,
        difference: moneyDiff(expectedTotal, invoice.total!),
        evidence: {
          subtotal: invoice.subtotal,
          tax: invoice.tax,
          discount: discount || undefined,
          shipping: shipping || undefined,
          adjustments: adjustments || undefined
        }
      });
    }
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
    reconciliationStatus,
    reconciliationMessage,
    findings
  };
}
