import mongoose, { Schema, Document, Types } from "mongoose";

export interface IAuditLog extends Document {
  organizationId: Types.ObjectId;
  invoiceId?: Types.ObjectId;
  actorId: Types.ObjectId;
  actorRole: "ORGANIZATION_ADMIN" | "PROCUREMENT_OFFICER" | "FINANCE_MANAGER" | "VENDOR";
  action: string;
  resourceType: "INVOICE" | "ORGANIZATION" | "USER" | "VENDOR" | "PAYMENT";
  resourceId: string;
  changes?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
  };
  metadata?: Record<string, any>;
  timestamp: Date;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: [true, "Organization ID is required"],
      index: true,
    },
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Actor ID is required"],
    },
    actorRole: {
      type: String,
      enum: ["ORGANIZATION_ADMIN", "PROCUREMENT_OFFICER", "FINANCE_MANAGER", "VENDOR"],
      required: [true, "Actor role is required"],
    },
    action: {
      type: String,
      required: [true, "Action is required"],
      enum: [
        "INVOICE_SUBMITTED",
        "OCR_STARTED",
        "OCR_COMPLETED",
        "PROCUREMENT_REVIEW_STARTED",
        "PROCUREMENT_VERIFIED",
        "PROCUREMENT_REJECTED",
        "FINANCE_REVIEW_STARTED",
        "FINANCE_APPROVED",
        "FINANCE_REJECTED",
        "PAYMENT_INITIATED",
        "PAYMENT_PROCESSING",
        "PAYMENT_COMPLETED",
        "INVOICE_DELETED",
        "ORGANIZATION_CREATED",
        "USER_ADDED",
        "USER_REMOVED",
        "VENDOR_ONBOARDED",
      ],
    },
    resourceType: {
      type: String,
      enum: ["INVOICE", "ORGANIZATION", "USER", "VENDOR", "PAYMENT"],
      required: [true, "Resource type is required"],
    },
    resourceId: {
      type: String,
      required: [true, "Resource ID is required"],
      index: true,
    },
    changes: {
      type: Schema.Types.Mixed,
      default: {},
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Indexes for efficient querying
auditLogSchema.index({ organizationId: 1, timestamp: -1 });
auditLogSchema.index({ invoiceId: 1, timestamp: -1 });
auditLogSchema.index({ actorId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1 });

export const AuditLog = mongoose.model<IAuditLog>("AuditLog", auditLogSchema);
