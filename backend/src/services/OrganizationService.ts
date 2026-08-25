import { Organization, IOrganization } from "../models/Organization";
import { User, IUser } from "../models/User";
import { generateToken, JWTPayload } from "../config/jwt";
import { Types } from "mongoose";

export interface CreateOrganizationInput {
  name: string;
  legalName?: string;
  gstin?: string;
  registrationNumber?: string;
  email: string;
  officialName: string;
  officialEmail: string;
  officialPassword: string;
  procurementOfficerName: string;
  procurementOfficerEmail: string;
  procurementOfficerPassword: string;
  financeManagerName: string;
  financeManagerEmail: string;
  financeManagerPassword: string;
}

export interface OrganizationResponse {
  organization: any;
  official: any;
  procurementOfficer: any;
  financeManager: any;
  tokens: {
    official: string;
    procurementOfficer: string;
    financeManager: string;
  };
}

export class OrganizationService {
  /**
   * Create organization with admin, procurement officer, and finance manager
   */
  async createOrganization(input: CreateOrganizationInput): Promise<OrganizationResponse> {
    // Validate all emails are unique
    const existingEmails = await User.find({
      email: {
        $in: [
          input.officialEmail,
          input.procurementOfficerEmail,
          input.financeManagerEmail,
        ],
      },
    });

    if (existingEmails.length > 0) {
      throw new Error(
        `Email(s) already exist: ${existingEmails.map((u) => u.email).join(", ")}`
      );
    }

    // Create official user (ORGANIZATION_ADMIN)
    const officialUser = new User({
      email: input.officialEmail,
      password: input.officialPassword,
      name: input.officialName,
      role: "ORGANIZATION_ADMIN",
    });
    await officialUser.save();

    try {
      // Create procurement officer
      const procurementUser = new User({
        email: input.procurementOfficerEmail,
        password: input.procurementOfficerPassword,
        name: input.procurementOfficerName,
        role: "PROCUREMENT_OFFICER",
      });
      await procurementUser.save();

      // Create finance manager
      const financeUser = new User({
        email: input.financeManagerEmail,
        password: input.financeManagerPassword,
        name: input.financeManagerName,
        role: "FINANCE_MANAGER",
      });
      await financeUser.save();

      // Create organization
      const organization = new Organization({
        name: input.name,
        legalName: input.legalName,
        gstin: input.gstin,
        registrationNumber: input.registrationNumber,
        email: input.email,
        officialUserId: officialUser._id,
        procurementOfficerId: procurementUser._id,
        financeManagerId: financeUser._id,
        status: "ACTIVE",
      });
      await organization.save();

      // Update users with organizationId
      await User.updateMany(
        {
          _id: {
            $in: [officialUser._id, procurementUser._id, financeUser._id],
          },
        },
        { organizationId: organization._id }
      );

      // Generate tokens
      const officialToken = generateToken({
        userId: officialUser._id.toString(),
        email: officialUser.email,
        role: officialUser.role,
        organizationId: organization._id.toString(),
      });

      const procurementToken = generateToken({
        userId: procurementUser._id.toString(),
        email: procurementUser.email,
        role: procurementUser.role,
        organizationId: organization._id.toString(),
      });

      const financeToken = generateToken({
        userId: financeUser._id.toString(),
        email: financeUser.email,
        role: financeUser.role,
        organizationId: organization._id.toString(),
      });

      return {
        organization: organization.toJSON(),
        official: officialUser.toJSON(),
        procurementOfficer: procurementUser.toJSON(),
        financeManager: financeUser.toJSON(),
        tokens: {
          official: officialToken,
          procurementOfficer: procurementToken,
          financeManager: financeToken,
        },
      };
    } catch (error) {
      // Rollback: delete official user if something failed
      await User.deleteOne({ _id: officialUser._id });
      throw error;
    }
  }

  /**
   * Get organization by ID
   */
  async getOrganizationById(organizationId: string): Promise<IOrganization | null> {
    return await Organization.findById(organizationId)
      .populate("officialUserId", "name email role")
      .populate("procurementOfficerId", "name email role")
      .populate("financeManagerId", "name email role");
  }

  /**
   * Get organization by official user ID
   */
  async getOrganizationByOfficialUserId(userId: string): Promise<IOrganization | null> {
    return await Organization.findOne({ officialUserId: new Types.ObjectId(userId) });
  }

  /**
   * Get all users in organization
   */
  async getOrganizationUsers(
    organizationId: string,
    role?: string
  ): Promise<IUser[]> {
    const query: any = { organizationId: new Types.ObjectId(organizationId) };
    if (role) {
      query.role = role;
    }
    return await User.find(query).select("-password");
  }

  /**
   * Update organization
   */
  async updateOrganization(
    organizationId: string,
    updates: Partial<IOrganization>
  ): Promise<IOrganization | null> {
    // Don't allow changing key references through this method
    const allowedUpdates = ["name", "legalName", "gstin", "registrationNumber", "status"];
    const filteredUpdates = Object.keys(updates)
      .filter((key) => allowedUpdates.includes(key))
      .reduce((obj, key) => {
        (obj as any)[key] = (updates as any)[key];
        return obj;
      }, {});

    return await Organization.findByIdAndUpdate(organizationId, filteredUpdates, {
      new: true,
    });
  }

  /**
   * Add user to organization
   */
  async addUserToOrganization(
    organizationId: string,
    userId: string,
    role: string
  ): Promise<IUser | null> {
    const user = await User.findByIdAndUpdate(
      userId,
      { organizationId: new Types.ObjectId(organizationId), role },
      { new: true }
    );
    return user;
  }

  /**
   * Remove user from organization
   */
  async removeUserFromOrganization(userId: string): Promise<boolean> {
    const result = await User.findByIdAndUpdate(
      userId,
      { organizationId: null },
      { new: true }
    );
    return !!result;
  }

  /**
   * Update procurement officer
   */
  async updateProcurementOfficer(
    organizationId: string,
    userId: string
  ): Promise<IOrganization | null> {
    return await Organization.findByIdAndUpdate(
      organizationId,
      { procurementOfficerId: new Types.ObjectId(userId) },
      { new: true }
    );
  }

  /**
   * Update finance manager
   */
  async updateFinanceManager(
    organizationId: string,
    userId: string
  ): Promise<IOrganization | null> {
    return await Organization.findByIdAndUpdate(
      organizationId,
      { financeManagerId: new Types.ObjectId(userId) },
      { new: true }
    );
  }

  /**
   * Get organization stats
   */
  async getOrganizationStats(organizationId: string): Promise<{
    totalUsers: number;
    totalVendors: number;
    totalInvoices: number;
  }> {
    const organizationIdObj = new Types.ObjectId(organizationId);

    const totalUsers = await User.countDocuments({
      organizationId: organizationIdObj,
    });

    // Stats to be implemented with Vendor and Invoice services
    return {
      totalUsers,
      totalVendors: 0,
      totalInvoices: 0,
    };
  }

  /**
   * Search organizations by name, legalName, or gstin
   */
  async searchOrganizations(query: string): Promise<IOrganization[]> {
    const searchRegex = new RegExp(query, "i"); // Case-insensitive search

    return await Organization.find({
      $or: [
        { name: searchRegex },
        { legalName: searchRegex },
        { gstin: searchRegex },
      ],
      status: "ACTIVE",
    }).limit(20);
  }
}

export const organizationService = new OrganizationService();
