// ============================================================================
// DOCUMENT LIFECYCLE STATUSES
// ============================================================================

export type DocumentStatus = 
  | "SUBMITTED"                    // Procurement uploaded
  | "EXTRACTION_PENDING"           // Waiting for OCR/extraction
  | "EXTRACTION_IN_PROGRESS"       // Extraction in progress
  | "EXTRACTION_COMPLETE"          // Extraction done
  | "EXTRACTION_FAILED"            // Extraction failed
  | "VERIFICATION_PENDING"         // Waiting for GST/vendor/PO verify
  | "VERIFICATION_COMPLETE"        // Verification done
  | "RISK_EVALUATED"               // Anomaly evaluation complete
  | "FINANCE_REVIEW_PENDING"       // Awaiting Finance Manager
  | "APPROVED"                     // Finance Manager approved
  | "REJECTED";                    // Finance Manager rejected

export type InvoiceType = "PO_BASED" | "NON_PO";

// ============================================================================
// VERIFICATION RESULTS
// ============================================================================

export interface VerificationResult {
  gstFormatValid?: boolean;
  gstVendorMatch?: boolean;
  vendorExists?: boolean;
  vendorActive?: boolean;
  poFound?: boolean;
  poVendorMatch?: boolean;
  errors?: string[];
}

// ============================================================================
// RISK & ANOMALY RESULTS
// ============================================================================

export interface RiskResult {
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  decision: "ELIGIBLE_FOR_AUTO_PROCESSING" | "REVIEW_REQUIRED" | "BLOCKED";
  signals: Array<{
    type: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    message: string;
  }>;
}

// ============================================================================
// APPROVAL DECISION
// ============================================================================

export interface ApprovalDecision {
  decision: "APPROVED" | "REJECTED";
  approverUserId: string;
  approverRole: string;
  comments?: string;
  timestamp: Date;
}

// ============================================================================
// UNIFIED INVOICE DOCUMENT (Complete Workflow)
// ============================================================================

export interface InvoiceDocument {
  // --------
  // DOCUMENT METADATA (Phase 2)
  // --------
  id: string;
  documentStatus: DocumentStatus;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;

  // --------
  // SUBMISSION TRACKING
  // --------
  uploaderUserId: string;
  submittedAt: Date;
  invoiceType: InvoiceType;

  // --------
  // STRUCTURED INVOICE DATA (From extraction, Phase 3)
  // --------
  invoiceNumber?: string | null;
  vendorId?: string | null;
  vendorName?: string | null;
  poId?: string | null;
  poNumber?: string | null;
  invoiceDate?: Date | null;
  dueDate?: Date | null;
  totalAmount?: number | null;
  subtotal?: number | null;
  taxAmount?: number | null;
  currency?: string | null;
  lineItems?: Array<{
    id?: string;
    sku?: string;
    description?: string;
    quantity?: number;
    unitPrice?: number;
    total?: number;
  }>;

  // --------
  // VERIFICATION RESULTS (Phase 2.5)
  // --------
  verificationResult?: VerificationResult;
  verificationCompleteAt?: Date | null;

  // --------
  // RISK & ANOMALY RESULTS (Phase 3)
  // --------
  riskResult?: RiskResult;
  riskEvaluatedAt?: Date | null;

  // --------
  // FINANCE APPROVAL (Phase 4)
  // --------
  approvalDecision?: ApprovalDecision | null;

  // --------
  // METADATA & AUDITING
  // --------
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    extractionAttempts?: number;
    lastExtractionError?: string;
    verificationAttempts?: number;
    lastVerificationError?: string;
  };
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface UploadInvoiceDocumentRequest {
  vendorId?: string;
  invoiceType: InvoiceType;
}

export interface UploadInvoiceDocumentResponse {
  id: string;
  storagePath: string;
  documentStatus: DocumentStatus;
  uploadedAt: string;
}

export interface SubmissionStatusResponse {
  id: string;
  documentStatus: DocumentStatus;
  invoiceNumber?: string | null;
  vendorId?: string | null;
  verificationResult?: VerificationResult;
  riskResult?: RiskResult;
  approvalDecision?: ApprovalDecision | null;
  updatedAt: string;
}
