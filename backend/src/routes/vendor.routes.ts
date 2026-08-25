import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { vendorService } from "../services/VendorService";
import { invoiceService } from "../services/InvoiceService";
import { organizationService } from "../services/OrganizationService";
import { verifyJWTToken, requireRole } from "../middleware/auth.middleware";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { badRequest, notFound, forbidden } from "../utils/errors";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

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
 * POST /api/vendor/organizations/search?q=
 * Search organizations by name, legalName, or gstin
 * Returns safe public information only
 */
router.post(
  "/organizations/search",
  verifyJWTToken,
  requireRole("VENDOR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { q } = req.query;

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

      // Submit invoice
      const invoice = await invoiceService.submitInvoice(
        req.user!.uid,
        organizationId,
        req.file.originalname
      );

      return sendSuccess(res, { invoice }, 201);
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
