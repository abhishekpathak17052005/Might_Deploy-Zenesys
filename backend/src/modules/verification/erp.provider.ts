/**
 * ERP Provider abstraction layer.
 * Allows swapping between mock, NetSuite, SAP, etc.
 * Currently implemented: MockNetSuiteProvider
 */

export interface ERPVendor {
  id: string;
  name: string;
  gstin: string;
  status: "ACTIVE" | "INACTIVE" | "BLOCKED";
  approvalStatus: "APPROVED" | "PENDING" | "REJECTED";
  registeredAt: string;
}

export interface ERPPurchaseOrder {
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

export interface ERPGLAccount {
  code: string;
  description: string;
  category: string;
}

export interface ERPInvoiceHistory {
  invoiceNumber: string;
  vendorName: string;
  amount: number;
  invoiceDate: string;
  status: "PAID" | "PENDING" | "PROCESSING";
}

/**
 * ERP Provider interface.
 * Implementations should connect to the actual ERP system.
 */
export interface ERPProvider {
  getVendor(vendorIdOrName: string): Promise<ERPVendor | null>;
  getPurchaseOrder(poNumber: string): Promise<ERPPurchaseOrder | null>;
  getGLAccount(glCode: string): Promise<ERPGLAccount | null>;
  getInvoiceHistory(vendorId: string): Promise<ERPInvoiceHistory[]>;
}

/**
 * Mock NetSuite provider for development/demo.
 * NOT a real NetSuite connection.
 * For production, implement with @netsuite/rest-client or similar.
 */
export class MockNetSuiteProvider implements ERPProvider {
  private mockVendors: Record<string, ERPVendor> = {
    "VENDOR-001": {
      id: "VENDOR-001",
      name: "ABC Technologies",
      gstin: "27ABCDE1234F1Z5",
      status: "ACTIVE",
      approvalStatus: "APPROVED",
      registeredAt: "2024-01-15"
    },
    "VENDOR-002": {
      id: "VENDOR-002",
      name: "Tech Solutions",
      gstin: "19TECHSOL1234F1Z5",
      status: "ACTIVE",
      approvalStatus: "APPROVED",
      registeredAt: "2024-02-10"
    },
    "VENDOR-003": {
      id: "VENDOR-003",
      name: "Office Pro",
      gstin: "09OFFICEP1234F1Z5",
      status: "ACTIVE",
      approvalStatus: "APPROVED",
      registeredAt: "2024-03-05"
    },
    "VENDOR-004": {
      id: "VENDOR-004",
      name: "Travel Express",
      gstin: "22TRAVELEX1234F1Z5",
      status: "ACTIVE",
      approvalStatus: "APPROVED",
      registeredAt: "2024-01-20"
    },
    "VENDOR-005": {
      id: "VENDOR-005",
      name: "Professional Services Inc",
      gstin: "28PROFSER1234F1Z5",
      status: "ACTIVE",
      approvalStatus: "APPROVED",
      registeredAt: "2024-04-01"
    }
  };

  private mockPOs: Record<string, ERPPurchaseOrder> = {
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

  private mockGLAccounts: Record<string, ERPGLAccount> = {
    "6050": {
      code: "6050",
      description: "IT Equipment Expense",
      category: "IT Equipment"
    },
    "6060": {
      code: "6060",
      description: "Software / SaaS Expense",
      category: "Software / SaaS"
    },
    "6010": {
      code: "6010",
      description: "Office Supplies Expense",
      category: "Office Supplies"
    },
    "6020": {
      code: "6020",
      description: "Travel Expense",
      category: "Travel"
    },
    "6070": {
      code: "6070",
      description: "Professional Services Expense",
      category: "Professional Services"
    },
    "6030": {
      code: "6030",
      description: "Utilities Expense",
      category: "Utilities"
    },
    "6040": {
      code: "6040",
      description: "Maintenance Expense",
      category: "Maintenance"
    },
    "6080": {
      code: "6080",
      description: "Marketing Expense",
      category: "Marketing"
    },
    "6090": {
      code: "6090",
      description: "Other Expense",
      category: "Other"
    }
  };

  private mockInvoiceHistory: Record<string, ERPInvoiceHistory[]> = {
    "VENDOR-001": [
      {
        invoiceNumber: "INV-2024-001",
        vendorName: "ABC Technologies",
        amount: 48000,
        invoiceDate: "2024-05-20",
        status: "PAID"
      },
      {
        invoiceNumber: "INV-2024-010",
        vendorName: "ABC Technologies",
        amount: 35000,
        invoiceDate: "2024-06-15",
        status: "PENDING"
      }
    ]
  };

  async getVendor(vendorIdOrName: string): Promise<ERPVendor | null> {
    // Try by ID first
    if (this.mockVendors[vendorIdOrName]) {
      return this.mockVendors[vendorIdOrName];
    }

    // Try by name (case-insensitive)
    const searchName = vendorIdOrName.toLowerCase();
    for (const vendor of Object.values(this.mockVendors)) {
      if (vendor.name.toLowerCase() === searchName) {
        return vendor;
      }
    }

    return null;
  }

  async getPurchaseOrder(poNumber: string): Promise<ERPPurchaseOrder | null> {
    return this.mockPOs[poNumber] || null;
  }

  async getGLAccount(glCode: string): Promise<ERPGLAccount | null> {
    return this.mockGLAccounts[glCode] || null;
  }

  async getInvoiceHistory(vendorId: string): Promise<ERPInvoiceHistory[]> {
    return this.mockInvoiceHistory[vendorId] || [];
  }
}

/**
 * Real NetSuite provider (future implementation).
 * Stub for now - would require @netsuite/rest-client setup.
 */
export class NetSuiteProvider implements ERPProvider {
  async getVendor(vendorIdOrName: string): Promise<ERPVendor | null> {
    // TODO: Implement real NetSuite API call
    throw new Error("NetSuite integration not yet implemented");
  }

  async getPurchaseOrder(poNumber: string): Promise<ERPPurchaseOrder | null> {
    // TODO: Implement real NetSuite API call
    throw new Error("NetSuite integration not yet implemented");
  }

  async getGLAccount(glCode: string): Promise<ERPGLAccount | null> {
    // TODO: Implement real NetSuite API call
    throw new Error("NetSuite integration not yet implemented");
  }

  async getInvoiceHistory(vendorId: string): Promise<ERPInvoiceHistory[]> {
    // TODO: Implement real NetSuite API call
    throw new Error("NetSuite integration not yet implemented");
  }
}

// Default to mock for development
export const erpProvider: ERPProvider = new MockNetSuiteProvider();
