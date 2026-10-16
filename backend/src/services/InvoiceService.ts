import { Invoice, IInvoice } from "../models/Invoice";
import { Vendor } from "../models/Vendor";
import { AuditLog } from "../models/AuditLog";
import { badRequest, notFound, forbidden } from "../utils/errors";
import { Types } from "mongoose";

export interface CreateInvoiceInput {
  invoiceNumber: string;
  vendorId: string;
  vendorName?: string;
  invoiceDate: Date;
  dueDate?: Date;
  totalAmount: number;
  gstin?: string;
  poNumber?: string;
  description?: string;
  attachmentUrl?: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
}

export interface GetInvoicesFilter {
  vendorId?: string;
  status?: string;
  uploadedBy?: string;
  organizationId?: string;
  skip?: number;
  limit?: number;
}

export class InvoiceService {
  async createInvoice(input: CreateInvoiceInput, uploadedByUserId: string): Promise<IInvoice> {
    const { User } = await import("../models/User");
    const user = await User.findById(uploadedByUserId);
    if (!user) throw notFound("User not found");
    if (!user.organizationId) throw badRequest("User is not associated with an organization");

    const vendor = await Vendor.findById(input.vendorId);
    if (!vendor) throw notFound("Vendor not found");

    const invoice = new Invoice({
      organizationId: user.organizationId,
      invoiceNumber: input.invoiceNumber,
      vendorId: new Types.ObjectId(input.vendorId),
      vendorName: input.vendorName || vendor.name,
      invoiceDate: input.invoiceDate,
      dueDate: input.dueDate,
      totalAmount: input.totalAmount,
      gstin: input.gstin,
      poNumber: input.poNumber,
      description: input.description,
      attachmentUrl: input.attachmentUrl,
      lineItems: input.lineItems,
      status: "OCR_PROCESSING",
      uploadedBy: new Types.ObjectId(uploadedByUserId),
    });

    await invoice.save();
    await this._audit({ organizationId: user.organizationId.toString(), actorId: uploadedByUserId, action: "INVOICE_CREATED", resourceId: invoice._id.toString(), newState: { status: "SUBMITTED", invoiceNumber: input.invoiceNumber } });
    return invoice;
  }

  async getInvoices(filter: GetInvoicesFilter, requestingUserId: string): Promise<{ invoices: IInvoice[]; total: number }> {
    const { User } = await import("../models/User");
    const user = await User.findById(requestingUserId);
    if (!user) throw notFound("User not found");

    const query: Record<string, unknown> = {};

    if (user.role !== "ORGANIZATION_ADMIN") {
      if (!user.organizationId) throw forbidden("User not associated with an organization");
      query.organizationId = user.organizationId;
    } else if (filter.organizationId) {
      query.organizationId = new Types.ObjectId(filter.organizationId);
    }

    if (user.role === "VENDOR" || user.role === "PROCUREMENT_OFFICER") {
      if (filter.uploadedBy) {
        query.uploadedBy = new Types.ObjectId(filter.uploadedBy);
      } else if (user.role === "PROCUREMENT_OFFICER") {
        query.uploadedBy = new Types.ObjectId(requestingUserId);
      }
    }

    if (filter.vendorId) query.vendorId = new Types.ObjectId(filter.vendorId);
    if (filter.status) query.status = filter.status;

    const skip = filter.skip || 0;
    const limit = filter.limit || 20;

    const [invoices, total] = await Promise.all([
      Invoice.find(query).populate("vendorId", "name gstin").populate("uploadedBy", "name email").sort({ createdAt: -1 }).skip(skip).limit(limit),
      Invoice.countDocuments(query),
    ]);

    return { invoices, total };
  }

  async getInvoiceById(invoiceId: string, requestingUserId: string): Promise<any | null> {
    const { User } = await import("../models/User");
    const { InvoiceDocumentModel } = await import("../models/InvoiceDocument");
    const user = await User.findById(requestingUserId);
    if (!user) throw notFound("User not found");

    if (Types.ObjectId.isValid(invoiceId)) {
      const invoice = await Invoice.findById(invoiceId)
        .populate("vendorId", "name gstin")
        .populate("uploadedBy", "name email")
        .populate("approvedBy", "name email");

      if (invoice) {
        const uploadedById = (invoice.uploadedBy as any)?._id?.toString() || (invoice.uploadedBy as any)?.toString();
        const invoiceVendorId = (invoice.vendorId as any)?._id?.toString() || (invoice.vendorId as any)?.toString();

        if (user.role === "VENDOR") {
          const vendor = await Vendor.findOne({ userId: requestingUserId });
          const isUploader = uploadedById === requestingUserId;
          const isVendorMatch = vendor && vendor._id.toString() === invoiceVendorId;
          if (!isUploader && !isVendorMatch) {
            throw forbidden("You do not have access to this invoice");
          }
        } else if (user.role !== "ORGANIZATION_ADMIN") {
          if (user.organizationId?.toString() !== invoice.organizationId.toString()) {
            throw forbidden("You do not have access to this invoice");
          }
        }

        return invoice;
      }
    }

    // Fallback: check InvoiceDocumentModel by UUID string
    const doc = await InvoiceDocumentModel.findOne({ id: invoiceId });
    if (doc) {
      if (
        user.role !== "ORGANIZATION_ADMIN" &&
        user.role !== "FINANCE_MANAGER" &&
        doc.uploaderUserId !== requestingUserId
      ) {
        throw forbidden("You do not have access to this invoice");
      }
      return doc.toObject();
    }

    return null;
  }

  async updateInvoiceStatus(invoiceId: string, newStatus: "APPROVED" | "REJECTED" | "ON_HOLD", approverId: string, rejectionReason?: string): Promise<IInvoice | null> {
    const allowedFromStatuses = ["OCR_PROCESSING", "OCR_COMPLETED", "PROCUREMENT_REVIEW", "ON_HOLD", "SUBMITTED"];
    const update: Record<string, unknown> = { status: newStatus, approvedBy: new Types.ObjectId(approverId) };
    if (rejectionReason) update.rejectionReason = rejectionReason;

    const invoice = await Invoice.findOneAndUpdate(
      { _id: new Types.ObjectId(invoiceId), status: { $in: allowedFromStatuses } },
      { $set: update },
      { new: true }
    );

    if (!invoice) {
      const existing = await Invoice.findById(invoiceId);
      if (!existing) throw notFound("Invoice not found");
      throw badRequest(`Cannot transition invoice from status '${existing.status}' to '${newStatus}'`);
    }

    await this._audit({ organizationId: invoice.organizationId.toString(), actorId: approverId, action: `INVOICE_${newStatus}`, resourceId: invoiceId, newState: { status: newStatus, rejectionReason } });
    return invoice;
  }

  async deleteInvoice(invoiceId: string, requestingUserId: string): Promise<void> {
    const { User } = await import("../models/User");
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) throw notFound("Invoice not found");
    const user = await User.findById(requestingUserId);
    if (!user) throw notFound("User not found");

    const isOwner = invoice.uploadedBy.toString() === requestingUserId;
    const isAdmin = user.role === "ORGANIZATION_ADMIN";
    const sameOrg = user.organizationId?.toString() === invoice.organizationId.toString();

    if (!isAdmin && !isOwner) throw forbidden("You can only delete your own invoices");
    if (!sameOrg && !isAdmin) throw forbidden("You do not have access to this invoice");
    if (invoice.status === "APPROVED") throw badRequest("Cannot delete an approved invoice");

    await Invoice.findByIdAndDelete(invoiceId);
    await this._audit({ organizationId: invoice.organizationId.toString(), actorId: requestingUserId, action: "INVOICE_DELETED", resourceId: invoiceId, newState: { deleted: true } });
  }

  async getPendingInvoices(requestingUserId: string, skip: number = 0, limit: number = 20): Promise<{ invoices: IInvoice[]; total: number }> {
    const { User } = await import("../models/User");
    const user = await User.findById(requestingUserId);
    if (!user) throw notFound("User not found");
    if (!user.organizationId) throw forbidden("User not associated with an organization");

    const reviewStatuses = ["OCR_COMPLETED", "PROCUREMENT_REVIEW", "ON_HOLD", "SUBMITTED"];
    const query = { organizationId: user.organizationId, status: { $in: reviewStatuses } };

    const [invoices, total] = await Promise.all([
      Invoice.find(query).populate("vendorId", "name gstin").populate("uploadedBy", "name email").sort({ createdAt: -1 }).skip(skip).limit(limit),
      Invoice.countDocuments(query),
    ]);

    return { invoices, total };
  }

  async getApprovalStats(requestingUserId: string): Promise<{ pending: number; approved: number; rejected: number; totalValue: number }> {
    const { User } = await import("../models/User");
    const user = await User.findById(requestingUserId);
    if (!user) throw notFound("User not found");
    if (!user.organizationId) throw forbidden("User not associated with an organization");

    const orgFilter = { organizationId: user.organizationId };
    const reviewStatuses = ["OCR_COMPLETED", "PROCUREMENT_REVIEW", "ON_HOLD", "SUBMITTED"];

    const [pending, approved, rejected, valueAgg] = await Promise.all([
      Invoice.countDocuments({ ...orgFilter, status: { $in: reviewStatuses } }),
      Invoice.countDocuments({ ...orgFilter, status: "APPROVED" }),
      Invoice.countDocuments({ ...orgFilter, status: "REJECTED" }),
      Invoice.aggregate([{ $match: { ...orgFilter, status: { $in: reviewStatuses } } }, { $group: { _id: null, totalValue: { $sum: "$totalAmount" } } }]),
    ]);

    return { pending, approved, rejected, totalValue: valueAgg[0]?.totalValue || 0 };
  }

  async updateOCRResult(invoiceId: string, ocrResult: IInvoice["ocrResult"], category?: string, categoryConfidence?: number): Promise<IInvoice | null> {
    return await Invoice.findByIdAndUpdate(invoiceId, { ocrResult, category, categoryConfidence, status: "OCR_COMPLETED" }, { new: true });
  }

  async updateRiskAnalysis(invoiceId: string, riskScore: number, riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL", anomalies: IInvoice["anomalies"]): Promise<IInvoice | null> {
    return await Invoice.findByIdAndUpdate(invoiceId, { riskScore, riskLevel, anomalies, status: "PROCUREMENT_REVIEW" }, { new: true });
  }

  async getOrganizationInvoices(organizationId: string, filters?: { vendorId?: string; status?: string; riskLevel?: string; limit?: number; offset?: number }): Promise<{ invoices: IInvoice[]; total: number }> {
    const query: Record<string, unknown> = { organizationId: new Types.ObjectId(organizationId) };
    if (filters?.vendorId) query.vendorId = new Types.ObjectId(filters.vendorId);
    if (filters?.status) query.status = filters.status;
    if (filters?.riskLevel) query.riskLevel = filters.riskLevel;

    const limit = filters?.limit || 20;
    const offset = filters?.offset || 0;

    const [invoices, total] = await Promise.all([
      Invoice.find(query).populate("vendorId", "name gstin").populate("uploadedBy", "name email").sort({ createdAt: -1 }).skip(offset).limit(limit),
      Invoice.countDocuments(query),
    ]);

    return { invoices, total };
  }

  async submitInvoice(
    userId: string,
    organizationId: string,
    attachmentUrl?: string,
    attachmentData?: Buffer,
    attachmentMimeType?: string
  ): Promise<IInvoice> {
    const vendor = await Vendor.findOne({ userId });
    if (!vendor) {
      throw notFound("Vendor profile not found for user");
    }

    const hasAccess = vendor.organizationIds.some(
      (id) => id.toString() === organizationId
    );
    if (!hasAccess) {
      throw forbidden("Vendor does not have access to this organization");
    }

    const invoice = new Invoice({
      organizationId: new Types.ObjectId(organizationId),
      vendorId: vendor._id,
      vendorName: vendor.name,
      uploadedBy: new Types.ObjectId(userId),
      status: "SUBMITTED",
      attachmentUrl,
      attachmentData,
      attachmentMimeType,
      lineItems: [],
    });

    await invoice.save();
    return invoice;
  }

  async verifyForFinance(invoiceId: string, reviewerId: string, organizationId?: string): Promise<IInvoice> {
    const invoice = await Invoice.findOneAndUpdate(
      {
        _id: new Types.ObjectId(invoiceId),
        ...(organizationId ? { organizationId: new Types.ObjectId(organizationId) } : {}),
        status: { $in: ["SUBMITTED", "OCR_PROCESSING", "OCR_COMPLETED", "PROCUREMENT_REVIEW", "RETURNED_TO_VENDOR"] },
      },
      {
        $set: {
          status: "FINANCE_REVIEW",
          procurementReviewedBy: new Types.ObjectId(reviewerId),
          procurementReviewedAt: new Date(),
          procurementDecision: "VERIFIED",
          returnReason: undefined,
        },
      },
      { new: true }
    );
    if (!invoice) throw badRequest("Invoice is not in a procurement-reviewable state or is outside your organization");
    await this._audit({ organizationId: invoice.organizationId.toString(), actorId: reviewerId, action: "PROCUREMENT_VERIFIED", resourceId: invoiceId, newState: { status: "FINANCE_REVIEW" } });
    return invoice;
  }

  async returnToVendor(invoiceId: string, reviewerId: string, reason: string, organizationId?: string): Promise<IInvoice> {
    const invoice = await Invoice.findOneAndUpdate(
      {
        _id: new Types.ObjectId(invoiceId),
        ...(organizationId ? { organizationId: new Types.ObjectId(organizationId) } : {}),
        status: { $in: ["SUBMITTED", "OCR_PROCESSING", "OCR_COMPLETED", "PROCUREMENT_REVIEW"] },
      },
      {
        $set: {
          status: "RETURNED_TO_VENDOR",
          returnReason: reason,
          procurementReviewedBy: new Types.ObjectId(reviewerId),
          procurementReviewedAt: new Date(),
          procurementDecision: "RETURNED",
        },
      },
      { new: true }
    );
    if (!invoice) throw badRequest("Invoice is not in a returnable procurement state or is outside your organization");
    await this._audit({ organizationId: invoice.organizationId.toString(), actorId: reviewerId, action: "PROCUREMENT_RETURNED", resourceId: invoiceId, newState: { status: "RETURNED_TO_VENDOR", reason } });
    return invoice;
  }

  async listVendorInvoices(
    userId: string,
    filters?: {
      organizationId?: string;
      status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ invoices: IInvoice[]; total: number }> {
    const vendor = await Vendor.findOne({ userId });
    if (!vendor) {
      throw notFound("Vendor profile not found");
    }

    const query: Record<string, unknown> = {
      vendorId: vendor._id,
    };

    if (filters?.organizationId) {
      query.organizationId = new Types.ObjectId(filters.organizationId);
    }

    if (filters?.status) {
      query.status = filters.status;
    }

    const limit = filters?.limit || 20;
    const offset = filters?.offset || 0;

    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .populate("organizationId")
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset),
      Invoice.countDocuments(query),
    ]);

    return { invoices, total };
  }

  async approveInvoice(invoiceId: string, approverId: string): Promise<IInvoice | null> {
    return await this.updateInvoiceStatus(invoiceId, "APPROVED", approverId);
  }

  async rejectInvoice(invoiceId: string, approverId: string, rejectionReason: string): Promise<IInvoice | null> {
    return await this.updateInvoiceStatus(invoiceId, "REJECTED", approverId, rejectionReason);
  }

  private async _audit(params: { organizationId: string; actorId: string; action: string; resourceId: string; newState?: Record<string, unknown>; previousState?: Record<string, unknown> }): Promise<void> {
    try {
      await AuditLog.create({
        organizationId: new Types.ObjectId(params.organizationId),
        actorId: new Types.ObjectId(params.actorId),
        action: params.action,
        resourceType: "Invoice",
        resourceId: params.resourceId,
        previousState: params.previousState,
        newState: params.newState,
        timestamp: new Date(),
      });
    } catch (err) {
      console.error("audit.write.failed", { action: params.action, resourceId: params.resourceId, error: err instanceof Error ? err.message : "unknown" });
    }
  }
}

export const invoiceService = new InvoiceService();
