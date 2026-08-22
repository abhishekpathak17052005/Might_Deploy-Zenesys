/**
 * Vendor verification service.
 * Checks vendor existence, status, approval, and identity match.
 * Uses deterministic business logic - no AI/ML.
 */

export interface VendorVerificationResult {
  vendorExists: boolean;
  vendorActive: boolean;
  vendorApproved: boolean;
  nameMatch: boolean;
  gstinMatch: boolean;
  vendorId?: string;
  vendorName?: string;
  vendorStatus?: "ACTIVE" | "INACTIVE" | "BLOCKED" | "NEW";
  vendorApprovalStatus?: "APPROVED" | "PENDING" | "REJECTED";
  source: "ERP" | "NEW_VENDOR";
  message: string;
  evidence: Record<string, unknown>;
}

/**
 * Mock vendor master database for demo purposes.
 * In production, this would query the ERP system.
 */
const MOCK_VENDORS: Record<
  string,
  {
    id: string;
    name: string;
    gstin: string;
    status: "ACTIVE" | "INACTIVE" | "BLOCKED";
    approvalStatus: "APPROVED" | "PENDING" | "REJECTED";
    registeredAt: string;
  }
> = {
  "ABC Technologies": {
    id: "VENDOR-001",
    name: "ABC Technologies",
    gstin: "27ABCDE1234F1Z5",
    status: "ACTIVE",
    approvalStatus: "APPROVED",
    registeredAt: "2024-01-15"
  },
  "Tech Solutions": {
    id: "VENDOR-002",
    name: "Tech Solutions",
    gstin: "19TECHSOL1234F1Z5",
    status: "ACTIVE",
    approvalStatus: "APPROVED",
    registeredAt: "2024-02-10"
  },
  "Office Pro": {
    id: "VENDOR-003",
    name: "Office Pro",
    gstin: "09OFFICEP1234F1Z5",
    status: "ACTIVE",
    approvalStatus: "APPROVED",
    registeredAt: "2024-03-05"
  },
  "Travel Express": {
    id: "VENDOR-004",
    name: "Travel Express",
    gstin: "22TRAVELEX1234F1Z5",
    status: "ACTIVE",
    approvalStatus: "APPROVED",
    registeredAt: "2024-01-20"
  },
  "Professional Services Inc": {
    id: "VENDOR-005",
    name: "Professional Services Inc",
    gstin: "28PROFSER1234F1Z5",
    status: "ACTIVE",
    approvalStatus: "APPROVED",
    registeredAt: "2024-04-01"
  }
};

export class VendorVerificationService {
  /**
   * Verify vendor details against the master database.
   */
  verify(input: {
    vendorName: string;
    gstin?: string;
    expectedVendorName?: string;
  }): VendorVerificationResult {
    const vendorName = (input.vendorName || "").trim();
    const expectedVendorName = (input.expectedVendorName || vendorName).trim();
    const vendor = MOCK_VENDORS[vendorName];

    // Vendor not found in master
    if (!vendor) {
      return {
        vendorExists: false,
        vendorActive: false,
        vendorApproved: false,
        nameMatch: false,
        gstinMatch: false,
        vendorStatus: "NEW",
        vendorApprovalStatus: undefined,
        source: "NEW_VENDOR",
        message: `Vendor "${vendorName}" not found in master database. This is a NEW VENDOR.`,
        evidence: {
          vendorName,
          lookupAttempted: true,
          foundInMaster: false
        }
      };
    }

    // Vendor found - check all attributes
    const nameMatch = vendor.name.toLowerCase() === expectedVendorName.toLowerCase();
    const gstinMatch = input.gstin ? input.gstin === vendor.gstin : true; // If GSTIN provided, must match
    const isActive = vendor.status === "ACTIVE";
    const isApproved = vendor.approvalStatus === "APPROVED";

    if (!isActive) {
      return {
        vendorExists: true,
        vendorActive: false,
        vendorApproved: isApproved,
        nameMatch,
        gstinMatch,
        vendorId: vendor.id,
        vendorName: vendor.name,
        vendorStatus: vendor.status,
        vendorApprovalStatus: vendor.approvalStatus,
        source: "ERP",
        message: `Vendor found but is ${vendor.status}. Cannot process invoices from inactive vendor.`,
        evidence: {
          vendorName: vendor.name,
          vendorId: vendor.id,
          status: vendor.status,
          approvalStatus: vendor.approvalStatus
        }
      };
    }

    if (!isApproved) {
      return {
        vendorExists: true,
        vendorActive: true,
        vendorApproved: false,
        nameMatch,
        gstinMatch,
        vendorId: vendor.id,
        vendorName: vendor.name,
        vendorStatus: vendor.status,
        vendorApprovalStatus: vendor.approvalStatus,
        source: "ERP",
        message: `Vendor exists and is active, but is not approved. Approval status: ${vendor.approvalStatus}`,
        evidence: {
          vendorName: vendor.name,
          vendorId: vendor.id,
          status: vendor.status,
          approvalStatus: vendor.approvalStatus
        }
      };
    }

    if (!nameMatch) {
      return {
        vendorExists: true,
        vendorActive: true,
        vendorApproved: true,
        nameMatch: false,
        gstinMatch,
        vendorId: vendor.id,
        vendorName: vendor.name,
        vendorStatus: vendor.status,
        vendorApprovalStatus: vendor.approvalStatus,
        source: "ERP",
        message: `Vendor name mismatch. Invoice vendor: "${vendorName}", Master record: "${vendor.name}"`,
        evidence: {
          invoiceVendor: vendorName,
          masterVendor: vendor.name,
          vendorId: vendor.id
        }
      };
    }

    if (!gstinMatch) {
      return {
        vendorExists: true,
        vendorActive: true,
        vendorApproved: true,
        nameMatch: true,
        gstinMatch: false,
        vendorId: vendor.id,
        vendorName: vendor.name,
        vendorStatus: vendor.status,
        vendorApprovalStatus: vendor.approvalStatus,
        source: "ERP",
        message: `Vendor GSTIN mismatch. Invoice GSTIN: "${input.gstin}", Master GSTIN: "${vendor.gstin}"`,
        evidence: {
          invoiceGstin: input.gstin,
          masterGstin: vendor.gstin,
          vendorName: vendor.name
        }
      };
    }

    // All checks passed
    return {
      vendorExists: true,
      vendorActive: true,
      vendorApproved: true,
      nameMatch: true,
      gstinMatch: true,
      vendorId: vendor.id,
      vendorName: vendor.name,
      vendorStatus: vendor.status,
      vendorApprovalStatus: vendor.approvalStatus,
      source: "ERP",
      message: `✓ Vendor verified: ${vendor.name} (ID: ${vendor.id}) - Active and Approved`,
      evidence: {
        vendorName: vendor.name,
        vendorId: vendor.id,
        status: vendor.status,
        approvalStatus: vendor.approvalStatus,
        gstinVerified: gstinMatch,
        nameVerified: nameMatch
      }
    };
  }
}

export const vendorVerificationService = new VendorVerificationService();
