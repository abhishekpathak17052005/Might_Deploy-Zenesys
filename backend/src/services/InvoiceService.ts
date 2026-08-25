import { Invoice, IInvoice } from "../models/Invoice";
import { Vendor } from "../models/Vendor";
import { badRequest, notFound, forbidden } from "../utils/errors";
import { Types } from "mongoose";

export interface SubmitInvoiceInput {
  organizationId: string;
  attachmentUrl?: string;
}

export class InvoiceService {
  /**
   * Submit invoice by vendor
   * Derives vendorId from the user's vendor association
   */
  async submitInvoice(
    userId: string,
    organizationId: string,
    attachmentUrl?: string
  ): Promise<IInvoice> {
    // Get vendor associated with user
    const vendor = await Vendor.findOne({ userId });
    if (!vendor) {
      throw notFound("Vendor profile not found for user");
    }

    // Check if vendor has access to organization
    const hasAccess = vendor.organizationIds.some(
      (id) => id.toString() === organizationId
    );
    if (!hasAccess) {
      throw forbidden("Vendor does not have access to this organization");
    }

    // Create invoice with SUBMITTED status
    const invoice = new Invoice({
      organizationId: new Types.ObjectId(organizationId),
      vendorId: vendor._id,
      vendorName: vendor.name,
      uploadedBy: new Types.ObjectId(userId),
      status: "SUBMITTED",
      attachmentUrl,
      lineItems: [],
    });

    await invoice.save();

    // TODO: Queue OCR processing (reuse existing OCR engine)
    // For now, we'll manually update to OCR_PROCESSING
    invoice.status = "OCR_PROCESSING";
    await invoice.save();

    return invoice;
  }

  /**
   * Get invoice by ID with vendor access check
   */
  async getInvoiceById(invoiceId: string, userId: string): Promise<IInvoice | null> {
    const invoice = await Invoice.findById(invoiceId)
      .populate("vendorId")
      .populate("organizationId");

    if (!invoice) {
      return null;
    }

    // Check access: user must be the uploader OR be associated with the vendor
    const vendor = await Vendor.findOne({ userId });
    if (invoice.uploadedBy.toString() !== userId && vendor?._id.toString() !== invoice.vendorId.toString()) {
      throw forbidden("You do not have access to this invoice");
    }

    return invoice;
  }

  /**
   * List invoices for a vendor
   */
  async listVendorInvoices(
    userId: string,
    filters?: {
      organizationId?: string;
      status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ invoices: IInvoice[]; total: number }> {
    // Get vendor for user
    const vendor = await Vendor.findOne({ userId });
    if (!vendor) {
      throw notFound("Vendor profile not found");
    }

    const query: any = {
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

    const invoices = await Invoice.find(query)
      .populate("organizationId")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset);

    const total = await Invoice.countDocuments(query);

    return { invoices, total };
  }

  /**
   * Update OCR result on invoice
   */
  async updateOCRResult(
    invoiceId: string,
    ocrResult: any,
    category?: string,
    categoryConfidence?: number
  ): Promise<IInvoice | null> {
    const invoice = await Invoice.findByIdAndUpdate(
      invoiceId,
      {
        ocrResult,
        category,
        categoryConfidence,
        status: "OCR_COMPLETED",
      },
      { new: true }
    );

    return invoice;
  }

  /**
   * Update risk analysis on invoice
   */
  async updateRiskAnalysis(
    invoiceId: string,
    riskScore: number,
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
    anomalies: any[]
  ): Promise<IInvoice | null> {
    const invoice = await Invoice.findByIdAndUpdate(
      invoiceId,
      {
        riskScore,
        riskLevel,
        anomalies,
        status: "PROCUREMENT_REVIEW",
      },
      { new: true }
    );

    return invoice;
  }

  /**
   * Approve invoice
   */
  async approveInvoice(
    invoiceId: string,
    approverId: string
  ): Promise<IInvoice | null> {
    return await Invoice.findByIdAndUpdate(
      invoiceId,
      {
        status: "APPROVED",
        approvedBy: new Types.ObjectId(approverId),
      },
      { new: true }
    );
  }

  /**
   * Reject invoice
   */
  async rejectInvoice(
    invoiceId: string,
    approverId: string,
    rejectionReason: string
  ): Promise<IInvoice | null> {
    return await Invoice.findByIdAndUpdate(
      invoiceId,
      {
        status: "REJECTED",
        approvedBy: new Types.ObjectId(approverId),
        rejectionReason,
      },
      { new: true }
    );
  }

  /**
   * Get organization invoices
   */
  async getOrganizationInvoices(
    organizationId: string,
    filters?: {
      vendorId?: string;
      status?: string;
      riskLevel?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ invoices: IInvoice[]; total: number }> {
    const query: any = {
      organizationId: new Types.ObjectId(organizationId),
    };

    if (filters?.vendorId) {
      query.vendorId = new Types.ObjectId(filters.vendorId);
    }

    if (filters?.status) {
      query.status = filters.status;
    }

    if (filters?.riskLevel) {
      query.riskLevel = filters.riskLevel;
    }

    const limit = filters?.limit || 20;
    const offset = filters?.offset || 0;

    const invoices = await Invoice.find(query)
      .populate("vendorId")
      .populate("uploadedBy")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset);

    const total = await Invoice.countDocuments(query);

    return { invoices, total };
  }
}

export const invoiceService = new InvoiceService();
