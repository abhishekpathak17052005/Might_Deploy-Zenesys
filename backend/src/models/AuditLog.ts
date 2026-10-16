import mongoose, { Schema, Document, Types } from "mongoose";

export interface IAuditLog extends Document {
  organizationId: Types.ObjectId;
  invoiceId?: Types.ObjectId;
  actorId: Types.ObjectId;
  actorRole?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  previousState?: Record<string, any>;
  newState?: Record<string, any>;
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
    },
    action: {
      type: String,
      required: [true, "Action is required"],
    },
    resourceType: {
      type: String,
      required: [true, "Resource type is required"],
    },
    resourceId: {
      type: String,
      required: [true, "Resource ID is required"],
      index: true,
    },
    previousState: {
      type: Schema.Types.Mixed,
    },
    newState: {
      type: Schema.Types.Mixed,
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
