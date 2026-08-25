import mongoose, { Schema, Document, Types } from "mongoose";

export type InvoiceStatus = 
  | "SUBMITTED" 
  | "OCR_PROCESSING" 
  | "OCR_COMPLETED" 
  | "PROCUREMENT_REVIEW" 
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
  lineItems?: Array<{
    description?: string;
    quantity?: number;
    unitPrice?: number;
    amount?: number;
  }>;
  confidence?: Record<string, number>;
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
  gstin?: string;
  poNumber?: string;
  description?: string;
  status: InvoiceStatus;
  uploadedBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  rejectionReason?: string;
  attachmentUrl?: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
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
        "OCR_PROCESSING",
        "OCR_COMPLETED",
        "PROCUREMENT_REVIEW",
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
    attachmentUrl: {
      type: String,
    },
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

export const Invoice = mongoose.model<IInvoice>("Invoice", invoiceSchema);
