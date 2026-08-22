/**
 * GST (Goods and Services Tax) verification service.
 * Performs DETERMINISTIC validation:
 * 1. GSTIN format validation (regex)
 * 2. Vendor master matching (ERP lookup)
 * 3. Clear messaging that official government verification is NOT implemented
 */

export interface GstVerificationResult {
  gstin: string;
  formatValid: boolean;
  vendorMatch: boolean;
  exists: boolean;
  status:
    | "VALID_FORMAT"
    | "INVALID_FORMAT"
    | "VENDOR_MATCH"
    | "VENDOR_MISMATCH"
    | "NEW_VENDOR"
    | "VERIFICATION_UNAVAILABLE";
  officialVerificationAvailable: false; // Always false - we don't have real government API
  evidence: {
    formatCheckPassed: boolean;
    vendorFound?: boolean;
    vendorName?: string;
  };
  message: string;
}

/**
 * GSTIN format: 2 digits (state) + 5 uppercase letters (name) + 4 digits (sequence)
 * + 1 letter (check digit category) + 1 letter/digit + Z + 1 character
 * Example: 27ABCDE1234F1Z5
 */
const GSTIN_FORMAT_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/**
 * Mock vendor master database for demo purposes.
 * In production, this would query the ERP system.
 */
const MOCK_VENDOR_GSTIN_MAP: Record<string, string> = {
  "ABC Technologies": "27ABCDE1234F1Z5",
  "Tech Solutions": "19TECHSOL1234F1Z5",
  "Office Pro": "09OFFICEP1234F1Z5",
  "Travel Express": "22TRAVELEX1234F1Z5",
  "Professional Services Inc": "28PROFSER1234F1Z5",
  "Power Company": "06POWERCO1234F1Z5",
  "Maintenance Plus": "12MAINTPLS1234F1Z5",
  "Marketing Experts": "18MARKETEX1234F1Z5"
};

export class GstVerificationService {
  /**
   * Verify a GSTIN against format and vendor master.
   */
  verify(input: { gstin: string | null | undefined; vendorName?: string | null }): GstVerificationResult {
    const gstin = (input.gstin || "").trim();

    // No GSTIN provided
    if (!gstin) {
      return {
        gstin: "",
        formatValid: false,
        vendorMatch: false,
        exists: false,
        status: "VERIFICATION_UNAVAILABLE",
        officialVerificationAvailable: false,
        evidence: {
          formatCheckPassed: false
        },
        message: "No GSTIN provided"
      };
    }

    // Check format
    const formatValid = GSTIN_FORMAT_REGEX.test(gstin);

    if (!formatValid) {
      return {
        gstin,
        formatValid: false,
        vendorMatch: false,
        exists: false,
        status: "INVALID_FORMAT",
        officialVerificationAvailable: false,
        evidence: {
          formatCheckPassed: false
        },
        message: `GSTIN format is invalid. Expected format: 27ABCDE1234F1Z5`
      };
    }

    // Format is valid, check vendor match
    const vendorName = (input.vendorName || "").trim();
    const expectedGstin = MOCK_VENDOR_GSTIN_MAP[vendorName];

    if (expectedGstin && expectedGstin === gstin) {
      return {
        gstin,
        formatValid: true,
        vendorMatch: true,
        exists: true,
        status: "VENDOR_MATCH",
        officialVerificationAvailable: false,
        evidence: {
          formatCheckPassed: true,
          vendorFound: true,
          vendorName
        },
        message: `✓ GSTIN format is valid and matches vendor master record`
      };
    }

    if (expectedGstin && expectedGstin !== gstin) {
      return {
        gstin,
        formatValid: true,
        vendorMatch: false,
        exists: false,
        status: "VENDOR_MISMATCH",
        officialVerificationAvailable: false,
        evidence: {
          formatCheckPassed: true,
          vendorFound: true,
          vendorName
        },
        message: `GSTIN does not match vendor master. Vendor ${vendorName} has GSTIN ${expectedGstin}`
      };
    }

    // Format valid but vendor not in master (new vendor)
    return {
      gstin,
      formatValid: true,
      vendorMatch: false,
      exists: false,
      status: "NEW_VENDOR",
      officialVerificationAvailable: false,
      evidence: {
        formatCheckPassed: true,
        vendorFound: false
      },
      message: `✓ GSTIN format is valid. Vendor not found in master database (new vendor - manual verification may be required)`
    };
  }
}

export const gstVerificationService = new GstVerificationService();
