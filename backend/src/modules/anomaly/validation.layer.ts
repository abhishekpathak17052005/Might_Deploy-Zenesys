import type { AnomalyContext, InvoiceInput } from "./anomaly.types";

export interface ValidationField {
  fieldName: string;
  value: unknown;
  isPresent: boolean;
  isValid: boolean;
  reason?: string;
}

export interface ValidationResult {
  canEvaluate: boolean;
  missingFields: ValidationField[];
  invalidFields: ValidationField[];
  summary: string;
}

/**
 * Layer 1: Validation
 * 
 * Validates available input data and distinguishes NOT_EVALUATED (insufficient data)
 * from a clean result. A rule cannot reliably evaluate if required data is missing.
 */
export class ValidationLayer {
  /**
   * Check if an invoice has minimal required fields for any evaluation.
   */
  static validateMinimalRequiredFields(invoice: InvoiceInput): ValidationResult {
    const missing: ValidationField[] = [];
    const invalid: ValidationField[] = [];

    // Invoice must have some identifier
    if (!invoice.invoiceNumber && !invoice.id) {
      missing.push({
        fieldName: "invoiceNumber or id",
        value: undefined,
        isPresent: false,
        isValid: false,
        reason: "Invoice must have invoiceNumber or id"
      });
    }

    // Invoice must have an amount
    if (invoice.totalAmount === undefined || invoice.totalAmount === null) {
      missing.push({
        fieldName: "totalAmount",
        value: undefined,
        isPresent: false,
        isValid: false,
        reason: "Invoice must have totalAmount"
      });
    }

    // Invoice must have a date
    if (!invoice.invoiceDate) {
      missing.push({
        fieldName: "invoiceDate",
        value: undefined,
        isPresent: false,
        isValid: false,
        reason: "Invoice must have invoiceDate"
      });
    }

    // Invoice must have a vendor reference
    if (!invoice.vendorId && !invoice.vendorName) {
      missing.push({
        fieldName: "vendorId or vendorName",
        value: undefined,
        isPresent: false,
        isValid: false,
        reason: "Invoice must have vendorId or vendorName"
      });
    }

    const canEvaluate = missing.length === 0 && invalid.length === 0;

    return {
      canEvaluate,
      missingFields: missing,
      invalidFields: invalid,
      summary: canEvaluate
        ? "All minimal required fields present"
        : `Missing ${missing.length} required fields, invalid ${invalid.length} fields`
    };
  }

  /**
   * Check if vendor context is available and usable.
   */
  static validateVendorContext(context: AnomalyContext): ValidationResult {
    const missing: ValidationField[] = [];

    if (!context.vendor) {
      missing.push({
        fieldName: "vendor",
        value: undefined,
        isPresent: false,
        isValid: false,
        reason: "Vendor context not provided"
      });
      return {
        canEvaluate: false,
        missingFields: missing,
        invalidFields: [],
        summary: "Vendor context missing"
      };
    }

    if (!context.vendor.id && !context.vendor.name) {
      missing.push({
        fieldName: "vendor.id or vendor.name",
        value: undefined,
        isPresent: false,
        isValid: false,
        reason: "Vendor must have id or name"
      });
    }

    return {
      canEvaluate: missing.length === 0,
      missingFields: missing,
      invalidFields: [],
      summary: missing.length === 0 ? "Vendor context valid" : `Vendor validation failed: ${missing.length} issues`
    };
  }

  /**
   * Check if purchase order context is available and usable.
   */
  static validatePurchaseOrderContext(context: AnomalyContext): ValidationResult {
    const missing: ValidationField[] = [];

    if (!context.purchaseOrder) {
      missing.push({
        fieldName: "purchaseOrder",
        value: undefined,
        isPresent: false,
        isValid: false,
        reason: "Purchase order context not provided"
      });
      return {
        canEvaluate: false,
        missingFields: missing,
        invalidFields: [],
        summary: "Purchase order context missing"
      };
    }

    if (context.purchaseOrder.totalAmount === undefined || context.purchaseOrder.totalAmount === null) {
      missing.push({
        fieldName: "purchaseOrder.totalAmount",
        value: undefined,
        isPresent: false,
        isValid: false,
        reason: "PO must have totalAmount"
      });
    }

    return {
      canEvaluate: missing.length === 0,
      missingFields: missing,
      invalidFields: [],
      summary: missing.length === 0 ? "Purchase order context valid" : `PO validation failed: ${missing.length} issues`
    };
  }

  /**
   * Check if historical invoice data is available and sufficient for analysis.
   */
  static validateHistoricalData(context: AnomalyContext, minimumRequired: number = 0): ValidationResult {
    const missing: ValidationField[] = [];

    if (!context.historicalInvoices || context.historicalInvoices.length === 0) {
      if (minimumRequired > 0) {
        missing.push({
          fieldName: "historicalInvoices",
          value: [],
          isPresent: false,
          isValid: false,
          reason: `At least ${minimumRequired} historical invoices required, but 0 provided`
        });
      }
    } else if (context.historicalInvoices.length < minimumRequired) {
      missing.push({
        fieldName: "historicalInvoices",
        value: context.historicalInvoices.length,
        isPresent: true,
        isValid: false,
        reason: `At least ${minimumRequired} historical invoices required, but only ${context.historicalInvoices.length} provided`
      });
    }

    return {
      canEvaluate: missing.length === 0,
      missingFields: missing,
      invalidFields: [],
      summary: missing.length === 0 ? `Historical data valid (${context.historicalInvoices?.length ?? 0} invoices)` : `Historical data insufficient: ${missing[0]?.reason}`
    };
  }

  /**
   * Check if tax/GST fields are present.
   */
  static validateTaxData(invoice: InvoiceInput): ValidationResult {
    const missing: ValidationField[] = [];

    if (!invoice.gstin) {
      missing.push({
        fieldName: "gstin",
        value: undefined,
        isPresent: false,
        isValid: false,
        reason: "GSTIN not provided"
      });
    }

    if (invoice.taxAmount === undefined || invoice.taxAmount === null) {
      missing.push({
        fieldName: "taxAmount",
        value: undefined,
        isPresent: false,
        isValid: false,
        reason: "Tax amount not provided"
      });
    }

    return {
      canEvaluate: missing.length === 0,
      missingFields: missing,
      invalidFields: [],
      summary: missing.length === 0 ? "Tax data present" : `Tax data missing: ${missing.map((f) => f.fieldName).join(", ")}`
    };
  }

  /**
   * Check if line items are present and usable.
   */
  static validateLineItems(invoice: InvoiceInput): ValidationResult {
    const missing: ValidationField[] = [];

    if (!invoice.lineItems || invoice.lineItems.length === 0) {
      missing.push({
        fieldName: "lineItems",
        value: [],
        isPresent: false,
        isValid: false,
        reason: "No line items provided"
      });
    }

    return {
      canEvaluate: missing.length === 0,
      missingFields: missing,
      invalidFields: [],
      summary: missing.length === 0 ? `Line items present (${invoice.lineItems?.length ?? 0})` : "No line items available"
    };
  }
}
