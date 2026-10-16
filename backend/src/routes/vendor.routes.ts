import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { vendorService } from "../services/VendorService";
import { invoiceService } from "../services/InvoiceService";
import { organizationService } from "../services/OrganizationService";
import { verifyJWTToken, requireRole } from "../middleware/auth.middleware";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { badRequest, notFound, forbidden } from "../utils/errors";
import { extractionService } from "../modules/extraction";
import { OCRSpaceError, validateInvoiceBytes } from "../modules/extraction/ocrSpaceProvider";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1_000_000 } });

/**
 * POST /api/vendor/register
 * Register a new vendor with email, password, name, gstin
 */
router.post("/register", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, confirmPassword, name, gstin } = req.body;

    if (!email || !password || !confirmPassword || !name) {
      return sendError(res, "VALIDATION_ERROR", "Missing required fields", 400);
    }

    const result = await vendorService.registerVendor({
      email,
      password,
      confirmPassword,
      name,
      gstin,
    });

    return sendSuccess(res, result, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vendor registration failed";
    return sendError(res, "REGISTRATION_ERROR", message, 400);
  }
});

/**
 * GET & POST /api/vendor/organizations/search?q=
 * Search organizations by name, legalName, or gstin
 * Returns safe public information only
 */
router.all(
  "/organizations/search",
  verifyJWTToken,
  requireRole("VENDOR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = (req.query.q as string) || (req.body?.q as string);

      if (!q || typeof q !== "string") {
        return sendError(res, "VALIDATION_ERROR", "Search query is required", 400);
      }

      // Search organizations by name, legalName, or gstin
      const organizations = await organizationService.searchOrganizations(q);

      // Return safe information only (no sensitive data)
      const safeOrganizations = organizations.map((org) => ({
        id: org._id,
        name: org.name,
        legalName: org.legalName,
        gstin: org.gstin,
        email: org.email,
      }));

      return sendSuccess(res, { organizations: safeOrganizations });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/vendor/organizations/select
 * Add organization to vendor's organizationIds
 * Body: { organizationId }
 */
router.post(
  "/organizations/select",
  verifyJWTToken,
  requireRole("VENDOR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { organizationId } = req.body;
      if (!organizationId) {
        return sendError(res, "VALIDATION_ERROR", "Organization ID is required", 400);
      }

      // Get vendor for authenticated user
      const vendor = await vendorService.getVendorByUserId(req.user!.uid);
      if (!vendor) {
        return sendError(res, "NOT_FOUND", "Vendor profile not found", 404);
      }

      // Add organization to vendor
      const updatedVendor = await vendorService.addOrganizationToVendor(
        vendor._id.toString(),
        organizationId
      );

      return sendSuccess(res, { vendor: updatedVendor }, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to select organization";
      if (message.includes("already associated")) {
        return sendError(res, "CONFLICT", message, 409);
      }
      if (message.includes("not found")) {
        return sendError(res, "NOT_FOUND", message, 404);
      }
      next(error);
    }
  }
);

/** DELETE /api/vendor/organizations/:organizationId */
router.delete(
  "/organizations/:organizationId",
  verifyJWTToken,
  requireRole("VENDOR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { organizationId } = req.params;
      if (!/^[a-f\d]{24}$/i.test(organizationId)) {
        return sendError(res, "VALIDATION_ERROR", "A valid organization ID is required", 400);
      }
      const vendor = await vendorService.getVendorByUserId(req.user!.uid);
      if (!vendor) return sendError(res, "NOT_FOUND", "Vendor profile not found", 404);
      const updatedVendor = await vendorService.removeOrganizationFromVendor(vendor._id.toString(), organizationId);
      return sendSuccess(res, { vendor: updatedVendor });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to remove organization connection";
      if (message.includes("not found")) return sendError(res, "NOT_FOUND", message, 404);
      next(error);
    }
  }
);

/**
 * POST /api/vendor/invoices
 * Submit invoice to organization
 * Body: { organizationId }
 * File: invoice document
 */
router.post(
  "/invoices",
  verifyJWTToken,
  requireRole("VENDOR"),
  upload.single("invoice"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { organizationId } = req.body;

      if (!organizationId) {
        return sendError(res, "VALIDATION_ERROR", "Organization ID is required", 400);
      }

      if (!req.file) {
        return sendError(res, "VALIDATION_ERROR", "Invoice file is required", 400);
      }
      try { validateInvoiceBytes(req.file.buffer, req.file.mimetype); }
      catch (error) {
        const message = error instanceof Error ? error.message : "Invalid invoice document";
        return sendError(res, "VALIDATION_ERROR", message, 400);
      }

      // Submit invoice
      const idempotencyKey = req.header("Idempotency-Key") || undefined;
      if (!idempotencyKey) return sendError(res, "VALIDATION_ERROR", "Idempotency-Key header is required for invoice uploads", 400);
      let invoice = await invoiceService.submitInvoice(
        req.user!.uid,
        organizationId,
        req.file.originalname,
        req.file.buffer,
        req.file.mimetype,
        idempotencyKey
      );

      const claimed = await invoiceService.claimVendorOCR(invoice._id.toString(), organizationId, invoice.attachmentSha256 || "");
      if (claimed) {
        try {
          const extracted = await extractionService.extract({ documentBuffer: req.file.buffer, mimeType: req.file.mimetype, filename: req.file.originalname, sourceDocumentId: invoice.sourceDocumentId, sourceDocumentVersion: invoice.sourceDocumentVersion });
          invoice = await invoiceService.saveVendorOCRResult(invoice._id.toString(), extracted);
        } catch (ocrError) {
          const message = ocrError instanceof OCRSpaceError ? `${ocrError.code}: ${ocrError.message}` : "Invoice extraction failed. The uploaded document is retained for review.";
          console.error("vendor.invoice.ocr_failed", { invoiceId: invoice._id.toString(), errorCode: ocrError instanceof OCRSpaceError ? ocrError.code : "EXTRACTION_FAILED" });
          invoice = await invoiceService.markVendorExtractionFailed(invoice._id.toString(), message);
        }
      }

      const safeInvoice = invoice.toObject ? invoice.toObject() : { ...invoice };
      delete safeInvoice.attachmentData;
      delete safeInvoice.idempotencyKey;
      return sendSuccess(res, { invoice: safeInvoice }, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit invoice";
      if (message.includes("does not have access")) {
        return sendError(res, "FORBIDDEN", message, 403);
      }
      if (message.includes("not found")) {
        return sendError(res, "NOT_FOUND", message, 404);
      }
      next(error);
    }
  }
);

/**
 * GET /api/vendor/invoices
 * List vendor's own invoices
 * Query params: organizationId (optional), status (optional), limit (optional), offset (optional)
 */
router.get(
  "/invoices",
  verifyJWTToken,
  requireRole("VENDOR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { organizationId, status, limit, offset } = req.query;

      const result = await invoiceService.listVendorInvoices(req.user!.uid, {
        organizationId: organizationId as string | undefined,
        status: status as string | undefined,
        limit: limit ? parseInt(limit as string, 10) : 20,
        offset: offset ? parseInt(offset as string, 10) : 0,
      });

      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/vendor/invoices/:id
 * Get invoice details
 */
router.get(
  "/invoices/:id",
  verifyJWTToken,
  requireRole("VENDOR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const invoice = await invoiceService.getInvoiceById(id, req.user!.uid);
      if (!invoice) {
        return sendError(res, "NOT_FOUND", "Invoice not found", 404);
      }

      return sendSuccess(res, { invoice });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to get invoice";
      if (message.includes("do not have access")) {
        return sendError(res, "FORBIDDEN", message, 403);
      }
      next(error);
    }
  }
);

/** DELETE /api/vendor/invoices/:id — withdraw an invoice request without deleting its audit record. */
router.delete(
  "/invoices/:id",
  verifyJWTToken,
  requireRole("VENDOR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
        return sendError(res, "VALIDATION_ERROR", "A valid invoice ID is required", 400);
      }
      const invoice = await invoiceService.withdrawVendorInvoice(req.params.id, req.user!.uid);
      return sendSuccess(res, { invoice });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to withdraw invoice request";
      if (message.includes("not found")) return sendError(res, "NOT_FOUND", message, 404);
      if (message.includes("can no longer be withdrawn")) return sendError(res, "INVALID_STATE", message, 409);
      next(error);
    }
  }
);

/** POST /api/vendor/invoices/:id/reprocess — retry OCR/structuring from the same stored upload. */
router.post(
  "/invoices/:id/reprocess",
  verifyJWTToken,
  requireRole("VENDOR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
        return sendError(res, "VALIDATION_ERROR", "A valid invoice ID is required", 400);
      }
      let invoice = await invoiceService.claimVendorOCRRetry(req.params.id, req.user!.uid);
      try {
        const buffer = invoice.attachmentData;
        if (!buffer) throw new Error("The original uploaded invoice document is unavailable.");
        const extracted = await extractionService.extract({
          documentBuffer: buffer,
          mimeType: invoice.attachmentMimeType || "application/pdf",
          filename: invoice.attachmentUrl || `invoice-${invoice._id.toString()}`,
          sourceDocumentId: invoice.sourceDocumentId,
          sourceDocumentVersion: invoice.sourceDocumentVersion,
        });
        invoice = await invoiceService.saveVendorOCRResult(invoice._id.toString(), extracted);
      } catch (error) {
        const message = error instanceof OCRSpaceError
          ? `${error.code}: ${error.message}`
          : error instanceof Error ? error.message : "Invoice reprocessing failed. The original document is retained for review.";
        invoice = await invoiceService.markVendorExtractionFailed(invoice._id.toString(), message);
      }
      const safeInvoice = invoice.toObject ? invoice.toObject() : { ...invoice };
      delete safeInvoice.attachmentData;
      delete safeInvoice.idempotencyKey;
      return sendSuccess(res, { invoice: safeInvoice });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to reprocess invoice";
      if (message.includes("not found")) return sendError(res, "NOT_FOUND", message, 404);
      if (message.includes("already processing") || message.includes("state has changed")) return sendError(res, "CONFLICT", message, 409);
      if (message.includes("unavailable") || message.includes("hash does not match")) return sendError(res, "INVALID_STATE", message, 409);
      next(error);
    }
  }
);

/**
 * GET /api/vendor/profile
 * Get current vendor profile
 */
router.get(
  "/profile",
  verifyJWTToken,
  requireRole("VENDOR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const vendor = await vendorService.getVendorByUserId(req.user!.uid);
      if (!vendor) {
        return sendError(res, "NOT_FOUND", "Vendor profile not found", 404);
      }

      return sendSuccess(res, { vendor });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
