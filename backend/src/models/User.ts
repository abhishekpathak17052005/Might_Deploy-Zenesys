import mongoose, { Schema, Document, Types } from "mongoose";
import * as bcrypt from "bcrypt";

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  role: "ORGANIZATION_ADMIN" | "PROCUREMENT_OFFICER" | "FINANCE_MANAGER" | "VENDOR";
  organizationId?: Types.ObjectId;
  vendorId?: Types.ObjectId;
  permissions?: string[];
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, "Invalid email format"],
      sparse: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    role: {
      type: String,
      enum: ["ORGANIZATION_ADMIN", "PROCUREMENT_OFFICER", "FINANCE_MANAGER", "VENDOR"],
      required: [true, "Role is required"],
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      index: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
    },
    permissions: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastLogin: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Unique compound index: email + organizationId
userSchema.index({ email: 1, organizationId: 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1, organizationId: 1 });
userSchema.index({ vendorId: 1 });
userSchema.index({ createdAt: -1 });

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON responses
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  return user;
};

export const User = mongoose.model<IUser>("User", userSchema);
