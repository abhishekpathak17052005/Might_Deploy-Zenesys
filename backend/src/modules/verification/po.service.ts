/**
 * Purchase Order (PO) verification service.
 * Verifies PO existence, vendor match, amount within balance, quantity checks.
 * Deterministic business logic - no AI/ML.
 */

export interface PoVerificationResult {
  poFound: boolean;
  poNumber: string;
  vendorMatch: boolean;
  amountWithinBalance: boolean;
  quantityWithinOrder: boolean;
  remainingBalance: number;
  remainingQuantity?: number;
  poValue?: number;
  poQuantity?: number;
  previouslyInvoiced: number;
  relatedInvoices: string[];
  source: "ERP" | "NOT_FOUND";
  message: string;
  evidence: Record<string, unknown>;
}

/**
 * Mock PO database for demo purposes.
 * In production, this would query the ERP system.
 */
const MOCK_PURCHASE_ORDERS: Record<
  string,
  {
    number: string;
    vendorName: string;
    vendorId: string;
    totalValue: number;
    currency: string;
    orderedQuantity: number;
    previouslyInvoicedAmount: number;
    previouslyInvoicedQuantity: number;
    relatedInvoices: string[];
    poDate: string;
    deliveryDate: string;
    status: "OPEN" | "PARTIALLY_INVOICED" | "FULLY_INVOICED" | "CLOSED";
  }
> = {
  "PO-1001": {
    number: "PO-1001",
    vendorName: "ABC Technologies",
    vendorId: "VENDOR-001",
    totalValue: 100000,
    currency: "INR",
    orderedQuantity: 10,
    previouslyInvoicedAmount: 48000,
    previouslyInvoicedQuantity: 5,
    relatedInvoices: ["INV-2024-001"],
    poDate: "2024-05-01",
    deliveryDate: "2024-06-30",
    status: "PARTIALLY_INVOICED"
  },
  "PO-1002": {
    number: "PO-1002",
    vendorName: "Office Pro",
    vendorId: "VENDOR-003",
    totalValue: 50000,
    currency: "INR",
    orderedQuantity: 100,
    previouslyInvoicedAmount: 0,
    previouslyInvoicedQuantity: 0,
    relatedInvoices: [],
    poDate: "2024-05-15",
    deliveryDate: "2024-07-15",
    status: "OPEN"
  },
  "PO-1003": {
    number: "PO-1003",
    vendorName: "Tech Solutions",
    vendorId: "VENDOR-002",
    totalValue: 75000,
    currency: "INR",
    orderedQuantity: 5,
    previouslyInvoicedAmount: 72000,
    previouslyInvoicedQuantity: 5,
    relatedInvoices: ["INV-2024-002", "INV-2024-003"],
    poDate: "2024-04-10",
    deliveryDate: "2024-05-31",
    status: "FULLY_INVOICED"
  }
};

export class PoVerificationService {
  /**
   * Verify PO against extracted invoice data.
   */
  verify(input: {
    poNumber: string | null | undefined;
    vendorName: string;
    invoiceAmount: number;
    invoiceQuantity?: number;
  }): PoVerificationResult {
    const poNumber = (input.poNumber || "").trim();

    // No PO provided
    if (!poNumber) {
      return {
        poFound: false,
        poNumber: "",
        vendorMatch: false,
        amountWithinBalance: false,
        quantityWithinOrder: false,
        remainingBalance: 0,
        relatedInvoices: [],
        source: "NOT_FOUND",
        message: "No PO number provided. Invoice may be non-PO based.",
        evidence: {
          poLookupAttempted: false
        }
      };
    }

    // PO not found
    const po = MOCK_PURCHASE_ORDERS[poNumber];
    if (!po) {
      return {
        poFound: false,
        poNumber,
        vendorMatch: false,
        amountWithinBalance: false,
        quantityWithinOrder: false,
        remainingBalance: 0,
        previouslyInvoiced: 0,
        relatedInvoices: [],
        source: "NOT_FOUND",
        message: `PO "${poNumber}" not found in master database.`,
        evidence: {
          poNumber,
          lookupAttempted: true
        }
      };
    }

    // PO found - check vendor match
    if (po.vendorName.toLowerCase() !== input.vendorName.toLowerCase()) {
      return {
        poFound: true,
        poNumber: po.number,
        vendorMatch: false,
        amountWithinBalance: false,
        quantityWithinOrder: false,
        remainingBalance: po.totalValue - po.previouslyInvoicedAmount,
        previouslyInvoiced: po.previouslyInvoicedAmount,
        relatedInvoices: po.relatedInvoices,
        source: "ERP",
        message: `PO vendor mismatch. PO vendor: "${po.vendorName}", Invoice vendor: "${input.vendorName}"`,
        evidence: {
          poNumber: po.number,
          poVendor: po.vendorName,
          invoiceVendor: input.vendorName
        }
      };
    }

    // Vendor matches - check amount
    const remainingBalance = po.totalValue - po.previouslyInvoicedAmount;
    const amountWithinBalance = input.invoiceAmount <= remainingBalance;

    if (!amountWithinBalance) {
      return {
        poFound: true,
        poNumber: po.number,
        vendorMatch: true,
        amountWithinBalance: false,
        quantityWithinOrder: false,
        remainingBalance,
        previouslyInvoiced: po.previouslyInvoicedAmount,
        poValue: po.totalValue,
        relatedInvoices: po.relatedInvoices,
        source: "ERP",
        message: `Invoice amount exceeds PO remaining balance. Invoice: ₹${input.invoiceAmount}, Remaining balance: ₹${remainingBalance}`,
        evidence: {
          poNumber: po.number,
          poTotal: po.totalValue,
          invoiceAmount: input.invoiceAmount,
          previouslyInvoiced: po.previouslyInvoicedAmount,
          remainingBalance
        }
      };
    }

    // Check quantity if provided
    let quantityWithinOrder = true;
    if (input.invoiceQuantity !== undefined) {
      const remainingQuantity =
        po.orderedQuantity - po.previouslyInvoicedQuantity;
      quantityWithinOrder = input.invoiceQuantity <= remainingQuantity;

      if (!quantityWithinOrder) {
        return {
          poFound: true,
          poNumber: po.number,
          vendorMatch: true,
          amountWithinBalance: true,
          quantityWithinOrder: false,
          remainingBalance,
          remainingQuantity,
          poQuantity: po.orderedQuantity,
          previouslyInvoiced: po.previouslyInvoicedAmount,
          relatedInvoices: po.relatedInvoices,
          source: "ERP",
          message: `Invoice quantity exceeds PO remaining quantity. Invoice: ${input.invoiceQuantity}, Remaining: ${remainingQuantity}`,
          evidence: {
            poNumber: po.number,
            poQuantity: po.orderedQuantity,
            invoiceQuantity: input.invoiceQuantity,
            previouslyInvoicedQuantity: po.previouslyInvoicedQuantity,
            remainingQuantity
          }
        };
      }
    }

    // All checks passed
    const remainingQuantity = po.orderedQuantity - po.previouslyInvoicedQuantity;
    return {
      poFound: true,
      poNumber: po.number,
      vendorMatch: true,
      amountWithinBalance: true,
      quantityWithinOrder: true,
      remainingBalance,
      remainingQuantity,
      poValue: po.totalValue,
      poQuantity: po.orderedQuantity,
      previouslyInvoiced: po.previouslyInvoicedAmount,
      relatedInvoices: po.relatedInvoices,
      source: "ERP",
      message: `✓ PO verified: ${po.number} - Vendor match, amount and quantity within limits`,
      evidence: {
        poNumber: po.number,
        poTotal: po.totalValue,
        invoiceAmount: input.invoiceAmount,
        remainingBalance,
        remainingQuantity,
        previouslyInvoiced: po.previouslyInvoicedAmount,
        relatedInvoices: po.relatedInvoices,
        poStatus: po.status
      }
    };
  }
}

export const poVerificationService = new PoVerificationService();
