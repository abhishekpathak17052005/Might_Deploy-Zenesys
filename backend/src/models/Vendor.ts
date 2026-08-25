import mongoose, { Schema, Document, Types } from "mongoose";

export interface IVendor extends Document {
  userId: Types.ObjectId;
  name: string;
  email?: string;
  gstin?: string;
  organizationIds: Types.ObjectId[];
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  isApproved: boolean;
  approvedOn?: Date;
  approvedBy?: Types.ObjectId;
  metadata?: {
    erpVendorCode?: string;
    erpData?: Record<string, any>;
    customFields?: Record<string, any>;
  };
  totalInvoices: number;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

const vendorSchema = new Schema<IVendor>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
      unique: true,
    },
    name: {
      type: String,
      required: [true, "Vendor name is required"],
      trim: true,
      index: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, "Invalid email format"],
    },
    gstin: {
      type: String,
      match: [/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z\d{1}$/, "Invalid GSTIN format"],
      sparse: true,
    },
    organizationIds: {
      type: [Schema.Types.ObjectId],
      ref: "Organization",
      default: [],
      index: true,
    },
    phone: {
      type: String,
      match: [/^[0-9]{10}$/, "Invalid phone number"],
    },
    address: {
      type: String,
    },
    city: {
      type: String,
    },
    state: {
      type: String,
    },
    pincode: {
      type: String,
      match: [/^[0-9]{6}$/, "Invalid pincode"],
    },
    bankName: {
      type: String,
    },
    accountNumber: {
      type: String,
    },
    ifscCode: {
      type: String,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "SUSPENDED"],
      default: "ACTIVE",
      index: true,
    },
    isApproved: {
      type: Boolean,
      default: false,
      index: true,
    },
    approvedOn: {
      type: Date,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    totalInvoices: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Indexes for common queries
vendorSchema.index({ status: 1, isApproved: 1 });
vendorSchema.index({ organizationIds: 1, status: 1 });
vendorSchema.index({ gstin: 1 });
vendorSchema.index({ createdAt: -1 });

export const Vendor = mongoose.model<IVendor>("Vendor", vendorSchema);
