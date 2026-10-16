import mongoose, { Schema, Document, Types } from "mongoose";

export type InvoiceStatus = 
  | "SUBMITTED" 
  | "REVIEW_REQUIRED"
  | "OCR_PROCESSING" 
  | "OCR_COMPLETED" 
  | "PROCUREMENT_REVIEW" 
  | "FINANCE_REVIEW"
  | "RETURNED_TO_VENDOR"
  | "WITHDRAWN"
  | "APPROVED" 
  | "REJECTED" 
  | "ON_HOLD";

export interface OCRResult {
  vendorName?: string;
  gstin?: string;
  invoiceNumber?: string;
  invoiceDate?: Date;
  poNumber?: string;
  totalAmount?: number;
  subtotal?: number;
  taxAmount?: number;
  lineItems?: Array<{
    description?: string;
    quantity?: number | null;
    unitPrice?: number | null;
    amount?: number | null;
  }>;
  confidence?: Record<string, number>;
  rawConfidence?: unknown;
  rawText?: string;
  fieldProvenance?: Record<string, unknown>;
  provider?: string;
  sourceDocumentId?: string;
  sourceDocumentVersion?: number;
  sourceDocumentSha256?: string;
  extractedAt?: Date;
}

export interface RiskAnalysis {
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  anomalies: Array<{
    type: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    message: string;
  }>;
  evaluatedAt: Date;
}

export interface IInvoice extends Document {
  organizationId: Types.ObjectId;
  invoiceNumber?: string;
  vendorId: Types.ObjectId;
  vendorName?: string;
  invoiceDate?: Date;
  dueDate?: Date;
  totalAmount?: number;
  subtotal?: number;
  taxAmount?: number;
  gstin?: string;
  poNumber?: string;
  description?: string;
  status: InvoiceStatus;
  uploadedBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  rejectionReason?: string;
  returnReason?: string;
  procurementReviewedBy?: Types.ObjectId;
  procurementReviewedAt?: Date;
  procurementExceptionAcknowledged?: boolean;
  procurementDecision?: "VERIFIED" | "RETURNED" | "REJECTED";
  approvalDecision?: {
    decision: "APPROVED" | "REJECTED";
    approverUserId: string;
    approverRole: string;
    comments?: string;
    timestamp: Date;
    id?: string;
  };
  attachmentUrl?: string;
  attachmentData?: Buffer;
  attachmentMimeType?: string;
  attachmentSha256?: string;
  sourceDocumentId?: string;
  sourceDocumentVersion?: number;
  idempotencyKey?: string;
  legacyExtractionDiscarded?: unknown;
  extractionStatus?: "PENDING" | "PROCESSING" | "SUCCEEDED" | "REVIEW_REQUIRED" | "FAILED";
  extractionError?: string;
  vendorMatchStatus?: "MATCH" | "MISMATCH" | "UNVERIFIED";
  poMatchStatus?: "MATCH" | "MISMATCH" | "UNVERIFIED" | "NOT_REQUIRED";
  riskEvaluationStatus?: "EVALUATED" | "NOT_EVALUATED";
  riskEvaluatedAt?: Date;
  lineItems: Array<{
    description: string;
    quantity?: number | null;
    unitPrice?: number | null;
    amount?: number | null;
  }>;
  // OCR & Extraction Fields
  ocrResult?: OCRResult;
  // Categorization Fields
  category?: string;
  categoryConfidence?: number;
  // Risk Analysis Fields
  riskScore?: number;
  riskLevel?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  anomalies?: Array<{
    type: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    message: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const invoiceSchema = new Schema<IInvoice>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: [true, "Organization ID is required"],
      index: true,
    },
    invoiceNumber: {
      type: String,
      trim: true,
      sparse: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: [true, "Vendor ID is required"],
      index: true,
    },
    vendorName: {
      type: String,
    },
    invoiceDate: {
      type: Date,
    },
    dueDate: {
      type: Date,
    },
    totalAmount: {
      type: Number,
      min: [0, "Amount cannot be negative"],
    },
    subtotal: { type: Number, min: 0 },
    taxAmount: { type: Number, min: 0 },
    gstin: {
      type: String,
      match: [/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z\d{1}$/, "Invalid GSTIN format"],
      sparse: true,
    },
    poNumber: {
      type: String,
    },
    description: {
      type: String,
    },
    status: {
      type: String,
      enum: [
        "SUBMITTED",
        "REVIEW_REQUIRED",
        "OCR_PROCESSING",
        "OCR_COMPLETED",
        "PROCUREMENT_REVIEW",
        "FINANCE_REVIEW",
        "RETURNED_TO_VENDOR",
        "WITHDRAWN",
        "APPROVED",
        "REJECTED",
        "ON_HOLD",
      ],
      default: "SUBMITTED",
      index: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    rejectionReason: {
      type: String,
    },
    returnReason: String,
    procurementReviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    procurementReviewedAt: Date,
    procurementExceptionAcknowledged: { type: Boolean, default: false },
    procurementDecision: {
      type: String,
      enum: ["VERIFIED", "RETURNED", "REJECTED"],
    },
    approvalDecision: Schema.Types.Mixed,
    attachmentUrl: {
      type: String,
    },
    attachmentData: {
      type: Buffer,
      select: false,
    },
    attachmentMimeType: String,
    attachmentSha256: String,
    sourceDocumentId: String,
    sourceDocumentVersion: Number,
    idempotencyKey: String,
    legacyExtractionDiscarded: { type: Schema.Types.Mixed, select: false },
    extractionStatus: { type: String, enum: ["PENDING", "PROCESSING", "SUCCEEDED", "REVIEW_REQUIRED", "FAILED"] },
    extractionError: String,
    vendorMatchStatus: { type: String, enum: ["MATCH", "MISMATCH", "UNVERIFIED"] },
    poMatchStatus: { type: String, enum: ["MATCH", "MISMATCH", "UNVERIFIED", "NOT_REQUIRED"] },
    riskEvaluationStatus: { type: String, enum: ["EVALUATED", "NOT_EVALUATED"], default: "NOT_EVALUATED" },
    riskEvaluatedAt: Date,
    lineItems: [
      {
        description: {
          type: String,
        },
        quantity: {
          type: Number,
          min: 0,
        },
        unitPrice: {
          type: Number,
          min: 0,
        },
        amount: {
          type: Number,
        },
      },
    ],
    // OCR & Extraction Results
    ocrResult: {
      vendorName: String,
      gstin: String,
      invoiceNumber: String,
      invoiceDate: Date,
      poNumber: String,
      totalAmount: Number,
      subtotal: Number,
      taxAmount: Number,
      lineItems: [
        {
          description: String,
          quantity: Number,
          unitPrice: Number,
          amount: Number,
        },
      ],
      confidence: Schema.Types.Mixed,
      extractedAt: Date,
      rawConfidence: Schema.Types.Mixed,
      rawText: String,
      fieldProvenance: Schema.Types.Mixed,
      provider: String,
      sourceDocumentId: String,
      sourceDocumentVersion: Number,
      sourceDocumentSha256: String,
    },
    // Categorization
    category: {
      type: String,
    },
    categoryConfidence: {
      type: Number,
      min: 0,
      max: 1,
    },
    // Risk Analysis
    riskScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    riskLevel: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      sparse: true,
    },
    anomalies: [
      {
        type: {
          type: String,
        },
        severity: {
          type: String,
          enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
        },
        message: {
          type: String,
        },
      },
    ],
  },
  { timestamps: true }
);

// Index for common queries
invoiceSchema.index({ organizationId: 1, status: 1 });
invoiceSchema.index({ organizationId: 1, vendorId: 1 });
invoiceSchema.index({ vendorId: 1, status: 1 });
invoiceSchema.index({ uploadedBy: 1, organizationId: 1 });
invoiceSchema.index({ status: 1, createdAt: -1 });
invoiceSchema.index({ organizationId: 1, riskLevel: 1 });
invoiceSchema.index({ organizationId: 1, uploadedBy: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } });

export const Invoice = mongoose.model<IInvoice>("Invoice", invoiceSchema);
