import mongoose, { Schema, Document, Types } from "mongoose";

export interface IOrganization extends Document {
  name: string;
  legalName?: string;
  gstin?: string;
  registrationNumber?: string;
  email: string;
  officialUserId: Types.ObjectId;
  procurementOfficerId?: Types.ObjectId;
  financeManagerId?: Types.ObjectId;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  metadata?: {
    erpProvider?: string;
    erpIntegrationData?: Record<string, any>;
    paymentProvider?: string;
    customFields?: Record<string, any>;
  };
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<IOrganization>(
  {
    name: {
      type: String,
      required: [true, "Organization name is required"],
      trim: true,
    },
    legalName: {
      type: String,
      trim: true,
    },
    gstin: {
      type: String,
      match: [/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z\d{1}$/, "Invalid GSTIN format"],
    },
    registrationNumber: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, "Invalid email format"],
    },
    officialUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Organization official user is required"],
    },
    procurementOfficerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    financeManagerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "SUSPENDED"],
      default: "ACTIVE",
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// Indexes for common queries
organizationSchema.index({ status: 1 });
organizationSchema.index({ email: 1 });
organizationSchema.index({ gstin: 1 });
organizationSchema.index({ officialUserId: 1 });
organizationSchema.index({ createdAt: -1 });

export const Organization = mongoose.model<IOrganization>("Organization", organizationSchema);
