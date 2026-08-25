import { User, IUser } from "../models/User";
import { Vendor, IVendor } from "../models/Vendor";
import { Organization, IOrganization } from "../models/Organization";
import { generateToken } from "../config/jwt";
import { badRequest, notFound } from "../utils/errors";

export interface RegisterVendorInput {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  gstin?: string;
}

export interface VendorRegisterResponse {
  user: Omit<IUser, "password">;
  vendor: IVendor;
  token: string;
}

export class VendorService {
  /**
   * Register a new vendor with User (VENDOR role) and Vendor profile
   */
  async registerVendor(input: RegisterVendorInput): Promise<VendorRegisterResponse> {
    // Validate passwords match
    if (input.password !== input.confirmPassword) {
      throw new Error("Passwords do not match");
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: input.email });
    if (existingUser) {
      throw new Error("Email already registered");
    }

    // Create User with VENDOR role
    const user = new User({
      email: input.email,
      password: input.password,
      name: input.name,
      role: "VENDOR",
    });
    await user.save();

    try {
      // Create Vendor profile
      const vendor = new Vendor({
        userId: user._id,
        name: input.name,
        email: input.email,
        gstin: input.gstin,
        organizationIds: [],
        status: "ACTIVE",
        isApproved: false,
      });
      await vendor.save();

      // Update User with vendorId
      await User.findByIdAndUpdate(user._id, { vendorId: vendor._id });

      // Generate token
      const token = generateToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      return {
        user: user.toJSON() as unknown as Omit<IUser, "password">,
        vendor,
        token,
      };
    } catch (error) {
      // Cleanup: delete user if vendor creation fails
      await User.findByIdAndDelete(user._id);
      throw error;
    }
  }

  /**
   * Add organization to vendor's organizationIds (no duplicates)
   */
  async addOrganizationToVendor(
    vendorId: string,
    organizationId: string
  ): Promise<IVendor> {
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      throw notFound("Vendor not found");
    }

    // Check if organization exists
    const org = await Organization.findById(organizationId);
    if (!org) {
      throw notFound("Organization not found");
    }

    // Check if already associated
    const orgIdObj = (organizationId as any) as typeof organizationId;
    if (
      vendor.organizationIds.some(
        (id) => id.toString() === organizationId
      )
    ) {
      throw new Error("Vendor already associated with this organization");
    }

    // Add organization
    vendor.organizationIds.push(organizationId as any);
    await vendor.save();

    return vendor;
  }

  /**
   * Get vendor profile by userId
   */
  async getVendorByUserId(userId: string): Promise<IVendor | null> {
    return await Vendor.findOne({ userId }).populate("organizationIds");
  }

  /**
   * Get vendor by ID
   */
  async getVendorById(vendorId: string): Promise<IVendor | null> {
    return await Vendor.findById(vendorId).populate("organizationIds");
  }

  /**
   * Check if vendor has access to organization
   */
  async vendorHasAccessToOrganization(
    vendorId: string,
    organizationId: string
  ): Promise<boolean> {
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return false;
    }

    return vendor.organizationIds.some(
      (id) => id.toString() === organizationId
    );
  }

  /**
   * Get vendor's accessible organizations
   */
  async getVendorOrganizations(vendorId: string): Promise<IOrganization[]> {
    const vendor = await Vendor.findById(vendorId).populate("organizationIds");
    if (!vendor) {
      throw notFound("Vendor not found");
    }

    return vendor.organizationIds as any as IOrganization[];
  }

  /**
   * Update vendor status
   */
  async updateVendorStatus(
    vendorId: string,
    status: "ACTIVE" | "INACTIVE" | "SUSPENDED"
  ): Promise<IVendor | null> {
    return await Vendor.findByIdAndUpdate(
      vendorId,
      { status },
      { new: true }
    );
  }

  /**
   * Approve vendor
   */
  async approveVendor(vendorId: string, approverId: string): Promise<IVendor | null> {
    return await Vendor.findByIdAndUpdate(
      vendorId,
      {
        isApproved: true,
        approvedOn: new Date(),
        approvedBy: approverId,
      },
      { new: true }
    );
  }

  /**
   * Get all vendors for an organization
   */
  async getOrganizationVendors(organizationId: string): Promise<IVendor[]> {
    return await Vendor.find({
      organizationIds: organizationId,
    });
  }
}

export const vendorService = new VendorService();
