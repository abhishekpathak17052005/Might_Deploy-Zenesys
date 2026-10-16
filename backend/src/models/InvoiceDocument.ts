import mongoose, { Schema, Document } from "mongoose";
import type { InvoiceDocument as IInvoiceDocumentType } from "../modules/invoices/invoice.types";

export interface IInvoiceDocumentModel extends Document, Omit<IInvoiceDocumentType, "id"> {
  id: string;
  fileData?: Buffer;
}

const invoiceDocumentSchema = new Schema<IInvoiceDocumentModel>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    documentStatus: {
      type: String,
      required: true,
      default: "SUBMITTED",
      index: true,
    },
    storagePath: {
      type: String,
      required: true,
    },
    originalFilename: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    fileSizeBytes: {
      type: Number,
      required: true,
    },
    fileData: {
      type: Buffer,
      select: false, // Don't return heavy buffer by default
    },
    uploaderUserId: {
      type: String,
      required: true,
      index: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    invoiceType: {
      type: String,
      enum: ["PO_BASED", "NON_PO"],
      required: true,
    },
    invoiceNumber: {
      type: String,
      sparse: true,
      index: true,
    },
    vendorId: {
      type: String,
      sparse: true,
      index: true,
    },
    vendorName: {
      type: String,
    },
    gstin: {
      type: String,
      sparse: true,
    },
    poId: {
      type: String,
    },
    poNumber: {
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
    },
    subtotal: {
      type: Number,
    },
    taxAmount: {
      type: Number,
    },
    currency: {
      type: String,
      default: "INR",
    },
    lineItems: {
      type: [Schema.Types.Mixed],
      default: [],
    },
    rawExtractionResult: {
      type: Schema.Types.Mixed,
    },
    extractionConfidence: {
      type: Schema.Types.Mixed,
    },
    extractionValidation: {
      type: Schema.Types.Mixed,
    },
    extractedAt: {
      type: Date,
    },
    extractionProvider: {
      type: Schema.Types.Mixed,
    },
    category: {
      type: Schema.Types.Mixed,
    },
    verificationResult: {
      type: Schema.Types.Mixed,
    },
    riskResult: {
      type: Schema.Types.Mixed,
    },
    approvalDecision: {
      type: Schema.Types.Mixed,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

invoiceDocumentSchema.index({ uploaderUserId: 1, submittedAt: -1 });

export const InvoiceDocumentModel =
  mongoose.models.InvoiceDocumentModel ||
  mongoose.model<IInvoiceDocumentModel>("InvoiceDocumentModel", invoiceDocumentSchema);
