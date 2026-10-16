import { Invoice, IInvoice } from "../models/Invoice";
import { Vendor } from "../models/Vendor";
import { AuditLog } from "../models/AuditLog";
import { badRequest, notFound, forbidden } from "../utils/errors";
import { Types } from "mongoose";
import { createHash } from "crypto";
import { AnomalyEngine } from "../modules/anomaly/anomaly.engine";

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

export function compareVendorIdentity(
  extractedName?: string | null,
  extractedGstin?: string | null,
  registeredName?: string | null,
  registeredGstin?: string | null
): "MATCH" | "MISMATCH" | "UNVERIFIED" {
  const normalize = (value?: string | null) => (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const name = normalize(extractedName);
  const masterName = normalize(registeredName);
  const gstin = (extractedGstin || "").toUpperCase();
  const masterGstin = (registeredGstin || "").toUpperCase();
  if (!name && !gstin) return "UNVERIFIED";
  if ((name && masterName && name === masterName) || (gstin && masterGstin && gstin === masterGstin)) return "MATCH";
  return "MISMATCH";
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
        .select("-attachmentData -legacyExtractionDiscarded")
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

  async getProcurementReview(invoiceId: string, requestingUserId: string): Promise<any> {
    let invoice = await this.getInvoiceById(invoiceId, requestingUserId);
    if (!invoice) throw notFound("Invoice not found");
    const { User } = await import("../models/User");
    const user = await User.findById(requestingUserId);
    if (!user?.organizationId || user.organizationId.toString() !== invoice.organizationId.toString()) {
      throw forbidden("You do not have access to this invoice");
    }

    invoice = await this.invalidateUnverifiableLegacyUpload(invoiceId, requestingUserId) || invoice;

    // The app has no payment ledger yet, so approved invoices are the payable balance on record.
    const outstandingInvoices = await Invoice.find({
      organizationId: invoice.organizationId,
      vendorId: invoice.vendorId?._id || invoice.vendorId,
      status: "APPROVED",
    }).select("invoiceNumber totalAmount createdAt dueDate").sort({ createdAt: -1 }).lean();
    const outstandingAmount = outstandingInvoices.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
    return { invoice, outstandingAmount, outstandingInvoices };
  }

  private async invalidateUnverifiableLegacyUpload(invoiceId: string, actorId: string): Promise<any | null> {
    const legacy = await Invoice.findById(invoiceId).select("+attachmentData +legacyExtractionDiscarded");
    if (!legacy) return null;
    if (!legacy.attachmentData || legacy.attachmentSha256 || legacy.extractionStatus) {
      return Invoice.findById(invoiceId).select("-attachmentData -legacyExtractionDiscarded").populate("vendorId", "name gstin");
    }
    const digest = createHash("sha256").update(legacy.attachmentData).digest("hex");
    const vendor = await Vendor.findById(legacy.vendorId).select("name");
    const snapshot = {
      invoiceNumber: legacy.invoiceNumber,
      vendorName: legacy.vendorName,
      invoiceDate: legacy.invoiceDate,
      dueDate: legacy.dueDate,
      totalAmount: legacy.totalAmount,
      subtotal: legacy.subtotal,
      taxAmount: legacy.taxAmount,
      gstin: legacy.gstin,
      poNumber: legacy.poNumber,
      description: legacy.description,
      lineItems: legacy.lineItems,
      ocrResult: legacy.ocrResult,
      riskScore: legacy.riskScore,
      riskLevel: legacy.riskLevel,
      anomalies: legacy.anomalies,
      invalidatedAt: new Date(),
      reason: "Legacy OCR values have no verifiable extraction provenance and cannot be trusted.",
    };
    const result = await Invoice.updateOne(
      { _id: legacy._id, attachmentSha256: { $exists: false }, extractionStatus: { $exists: false } },
      {
        $set: {
          attachmentSha256: digest,
          vendorName: vendor?.name || "",
          extractionStatus: "FAILED",
          extractionError: "Previous extraction had no verifiable provenance. Review the original uploaded bill and reprocess it.",
          vendorMatchStatus: "UNVERIFIED",
          poMatchStatus: "UNVERIFIED",
          riskEvaluationStatus: "NOT_EVALUATED",
          status: "REVIEW_REQUIRED",
          lineItems: [],
          legacyExtractionDiscarded: snapshot,
        },
        $unset: {
          invoiceNumber: 1, invoiceDate: 1, dueDate: 1, totalAmount: 1, subtotal: 1, taxAmount: 1,
          gstin: 1, poNumber: 1, description: 1, ocrResult: 1, riskScore: 1, riskLevel: 1,
          anomalies: 1, category: 1, categoryConfidence: 1, riskEvaluatedAt: 1,
        },
      }
    );
    if (result.modifiedCount > 0) {
      await this._audit({
        organizationId: legacy.organizationId.toString(), actorId, action: "INVOICE_LEGACY_OCR_INVALIDATED",
        resourceId: invoiceId,
        newState: { status: "REVIEW_REQUIRED", extractionStatus: "FAILED", attachmentSha256: digest },
        previousState: { legacyDerivedFieldsRemoved: true },
      });
    }
    return Invoice.findById(invoiceId).select("-attachmentData -legacyExtractionDiscarded").populate("vendorId", "name gstin");
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

  async getOrganizationInvoices(organizationId: string, filters?: { vendorId?: string; status?: string | string[]; riskLevel?: string; limit?: number; offset?: number }): Promise<{ invoices: IInvoice[]; total: number }> {
    const query: Record<string, unknown> = { organizationId: new Types.ObjectId(organizationId) };
    if (filters?.vendorId) query.vendorId = new Types.ObjectId(filters.vendorId);
    if (filters?.status) {
      query.status = Array.isArray(filters.status)
        ? { $in: filters.status }
        : filters.status;
    }
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
      attachmentSha256: attachmentData ? createHash("sha256").update(attachmentData).digest("hex") : undefined,
      extractionStatus: "PENDING",
      riskEvaluationStatus: "NOT_EVALUATED",
    });

    await invoice.save();
    return invoice;
  }

  async saveVendorOCRResult(invoiceId: string, extracted: import("../modules/extraction").ExtractionResult): Promise<IInvoice> {
    const invoice = await Invoice.findById(invoiceId).populate("vendorId", "name gstin status isApproved");
    if (!invoice) throw notFound("Invoice not found after upload");
    const data = extracted.invoice;
    const vendor = invoice.vendorId as any;
    const vendorMatchStatus = compareVendorIdentity(data.vendorName, data.gstin, vendor?.name, vendor?.gstin);
    const poMatchStatus = data.poNumber ? "UNVERIFIED" : "NOT_REQUIRED";
    const criticalFields = [extracted.confidence.invoiceNumber, extracted.confidence.vendorName, extracted.confidence.total];
    const lowConfidence = criticalFields.some((field) => field.status !== "EXTRACTED" || (field.confidence ?? 0) < 0.75);
    const extractionStatus = extracted.validation.status === "VALID" && data.total > 0 && data.items.length > 0 && !lowConfidence
      ? "SUCCEEDED" as const : "REVIEW_REQUIRED" as const;

    invoice.invoiceNumber = data.invoiceNumber || undefined;
    invoice.invoiceDate = Number.isNaN(data.invoiceDate.getTime()) ? undefined : data.invoiceDate;
    // Keep vendorName bound to the authenticated Vendor document, never OCR text.
    invoice.gstin = data.gstin || undefined;
    invoice.poNumber = data.poNumber || undefined;
    invoice.totalAmount = data.total > 0 ? data.total : undefined;
    invoice.subtotal = data.subtotal > 0 ? data.subtotal : undefined;
    invoice.taxAmount = data.tax > 0 ? data.tax : undefined;
    invoice.description = data.items.map((item) => item.description).filter(Boolean).join(", ") || undefined;
    invoice.lineItems = data.items.map((item) => ({ description: item.description, quantity: item.quantity, unitPrice: item.unitPrice, amount: item.amount })) as typeof invoice.lineItems;
    invoice.ocrResult = {
      invoiceNumber: data.invoiceNumber,
      invoiceDate: Number.isNaN(data.invoiceDate.getTime()) ? undefined : data.invoiceDate,
      vendorName: data.vendorName,
      gstin: data.gstin || undefined,
      poNumber: data.poNumber || undefined,
      totalAmount: data.total,
      subtotal: data.subtotal,
      taxAmount: data.tax,
      lineItems: data.items.map((item) => ({ description: item.description, quantity: item.quantity, unitPrice: item.unitPrice, amount: item.amount })),
      extractedAt: extracted.extractedAt,
      rawConfidence: extracted.confidence,
    };
    invoice.extractionStatus = extractionStatus;
    invoice.extractionError = extractionStatus === "SUCCEEDED" ? undefined : [
      lowConfidence ? "One or more critical OCR fields have low or missing confidence." : "",
      ...extracted.validation.findings.map((finding) => finding.message),
      !(data.total > 0) ? "A valid invoice total could not be extracted." : "",
      !data.items.length ? "No invoice line items were extracted." : "",
    ].filter(Boolean).join(" ") || "OCR output needs procurement review.";
    invoice.vendorMatchStatus = vendorMatchStatus;
    invoice.poMatchStatus = poMatchStatus;
    invoice.status = extractionStatus === "SUCCEEDED" && vendorMatchStatus === "MATCH" && poMatchStatus === "NOT_REQUIRED"
      ? "OCR_COMPLETED" : "REVIEW_REQUIRED";
    invoice.riskEvaluationStatus = "NOT_EVALUATED";
    await invoice.save();

    // Risk is calculated from fields reloaded from persistence and the authenticated vendor master record.
    const persisted = await Invoice.findById(invoiceId).populate("vendorId", "name gstin status isApproved");
    if (!persisted) throw notFound("Invoice not found after OCR persistence");
    const persistedVendor = persisted.vendorId as any;
    const riskResult = await new AnomalyEngine().evaluate({
      invoice: {
        id: persisted._id.toString(), invoiceNumber: persisted.invoiceNumber,
        invoiceType: persisted.poNumber ? "PO_BASED" : "NON_PO",
        vendorId: (persistedVendor?._id || persisted.vendorId).toString(),
        vendorName: persisted.ocrResult?.vendorName || persisted.vendorName,
        poNumber: persisted.poNumber, totalAmount: persisted.totalAmount,
        invoiceDate: persisted.invoiceDate, gstin: persisted.gstin,
        lineItems: persisted.lineItems.map((item) => ({ description: item.description, quantity: item.quantity, amount: item.amount })),
      },
      vendor: persistedVendor ? {
        id: persistedVendor._id.toString(), name: persistedVendor.name, gstin: persistedVendor.gstin,
        isActive: persistedVendor.status === "ACTIVE", isApproved: persistedVendor.isApproved,
      } : undefined,
      purchaseOrder: undefined, historicalInvoices: [], recentInvoices: [],
    });
    const extraSignals = [
      ...(vendorMatchStatus !== "MATCH" ? [{ type: `VENDOR_${vendorMatchStatus}`, severity: vendorMatchStatus === "MISMATCH" ? "HIGH" : "MEDIUM", message: `OCR vendor identity is ${vendorMatchStatus.toLowerCase()} against the authenticated vendor record.` }] : []),
      ...(extractionStatus !== "SUCCEEDED" ? [{ type: "EXTRACTION_REVIEW_REQUIRED", severity: "HIGH", message: invoice.extractionError || "OCR evidence requires review." }] : []),
    ];
    const score = Math.min(100, riskResult.risk.score + extraSignals.reduce((sum, signal) => sum + (signal.severity === "HIGH" ? 30 : 15), 0));
    const riskLevel = score > 75 ? "CRITICAL" : score > 50 ? "HIGH" : score > 20 ? "MEDIUM" : "LOW";
    const updated = await Invoice.findByIdAndUpdate(invoiceId, { $set: {
      riskScore: score, riskLevel, riskEvaluationStatus: "EVALUATED", riskEvaluatedAt: new Date(),
      anomalies: [...riskResult.signals.map((signal) => ({ type: signal.type, severity: signal.severity, message: signal.message })), ...extraSignals],
    } }, { new: true }).populate("vendorId", "name gstin");
    if (!updated) throw notFound("Invoice not found after risk evaluation");
    return updated;
  }

  async markVendorExtractionFailed(invoiceId: string, message: string): Promise<IInvoice> {
    const updated = await Invoice.findByIdAndUpdate(invoiceId, {
      $set: { extractionStatus: "FAILED", extractionError: message, status: "REVIEW_REQUIRED", riskEvaluationStatus: "NOT_EVALUATED" },
      $unset: { riskScore: 1, riskLevel: 1, anomalies: 1 },
    }, { new: true });
    if (!updated) throw notFound("Invoice not found after failed extraction");
    return updated;
  }

  async verifyForFinance(invoiceId: string, reviewerId: string, organizationId?: string, reviewConfirmed = false): Promise<IInvoice> {
    const existing = await Invoice.findOne({ _id: new Types.ObjectId(invoiceId), ...(organizationId ? { organizationId: new Types.ObjectId(organizationId) } : {}) }).select("+attachmentData");
    if (!existing) throw notFound("Invoice not found or is outside your organization");
    const hasUploadedSource = Boolean(existing.attachmentData || existing.attachmentSha256 || existing.attachmentUrl);
    const requiresAcknowledgement = hasUploadedSource && (existing.extractionStatus !== "SUCCEEDED" || existing.vendorMatchStatus !== "MATCH" || !["MATCH", "NOT_REQUIRED"].includes(existing.poMatchStatus || ""));
    if (requiresAcknowledgement && !reviewConfirmed) {
      throw badRequest("This invoice has unverified OCR, vendor, or PO evidence. Review the uploaded bill and explicitly acknowledge the exception before forwarding.");
    }
    const invoice = await Invoice.findOneAndUpdate(
      {
        _id: new Types.ObjectId(invoiceId),
        ...(organizationId ? { organizationId: new Types.ObjectId(organizationId) } : {}),
        status: { $in: ["SUBMITTED", "REVIEW_REQUIRED", "OCR_PROCESSING", "OCR_COMPLETED", "PROCUREMENT_REVIEW", "RETURNED_TO_VENDOR"] },
      },
      {
        $set: {
          status: "FINANCE_REVIEW",
          procurementReviewedBy: new Types.ObjectId(reviewerId),
          procurementReviewedAt: new Date(),
          procurementDecision: "VERIFIED",
          ...(requiresAcknowledgement ? { procurementExceptionAcknowledged: true } : {}),
          returnReason: undefined,
        },
      },
      { new: true }
    );
    if (!invoice) throw badRequest("Invoice is not in a procurement-reviewable state or is outside your organization");
    await this._audit({ organizationId: invoice.organizationId.toString(), actorId: reviewerId, action: "PROCUREMENT_VERIFIED", resourceId: invoiceId, newState: { status: "FINANCE_REVIEW", procurementExceptionAcknowledged: requiresAcknowledgement } });
    return invoice;
  }

  async returnToVendor(invoiceId: string, reviewerId: string, reason: string, organizationId?: string): Promise<IInvoice> {
    const invoice = await Invoice.findOneAndUpdate(
      {
        _id: new Types.ObjectId(invoiceId),
        ...(organizationId ? { organizationId: new Types.ObjectId(organizationId) } : {}),
        status: { $in: ["SUBMITTED", "REVIEW_REQUIRED", "OCR_PROCESSING", "OCR_COMPLETED", "PROCUREMENT_REVIEW"] },
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
