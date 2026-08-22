import express, { type Request, type Response } from "express";
import multer, { type MulterError } from "multer";
import { verifyFirebaseToken, requireRole } from "../../middleware/auth.middleware";
import { sendError, sendSuccess } from "../../utils/apiResponse";
import { uploadInvoiceDocumentRequestSchema } from "./invoice.schema";
import { invoiceDocumentService } from "./invoice.service";
import type { UploadInvoiceDocumentResponse } from "./invoice.types";

export const invoiceRouter = express.Router();

// Configure multer for in-memory file uploads (no disk storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter(
    _req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
  ) {
    // Allow PDF and image files
    const allowedMimeTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/tiff",
      "image/webp"
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}`));
    }
  }
});

// POST /invoices/upload - Upload an invoice document (PROCUREMENT role required)
invoiceRouter.post(
  "/upload",
  verifyFirebaseToken,
  requireRole("PROCUREMENT", "ADMIN"),
  upload.single("file"),
  async (req: Request, res: Response): Promise<Response> => {
    try {
      if (!req.file) {
        return sendError(res, "BAD_REQUEST", "No file provided", 400);
      }

      const bodyValidation = uploadInvoiceDocumentRequestSchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return sendError(res, "VALIDATION_ERROR", bodyValidation.error.message, 400);
      }

      const { invoiceType, vendorId } = bodyValidation.data;
      const userId = req.user?.uid;

      if (!userId) {
        return sendError(res, "UNAUTHORIZED", "User ID not found in token", 401);
      }

      const invoiceDocument = await invoiceDocumentService.uploadInvoiceDocument(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        userId,
        invoiceType,
        vendorId
      );

      const response: UploadInvoiceDocumentResponse = {
        id: invoiceDocument.id,
        storagePath: invoiceDocument.storagePath,
        documentStatus: invoiceDocument.documentStatus,
        uploadedAt: invoiceDocument.submittedAt.toISOString()
      };

      return sendSuccess(res, response, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("invoice.upload.failed", { error: message });
      return sendError(res, "INTERNAL_ERROR", message, 500);
    }
  }
);

// GET /invoices/:documentId - Get invoice document
invoiceRouter.get(
  "/:documentId",
  verifyFirebaseToken,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const { documentId } = req.params;
      const userId = req.user?.uid;

      if (!userId) {
        return sendError(res, "UNAUTHORIZED", "User ID not found in token", 401);
      }

      const document = await invoiceDocumentService.getInvoiceDocument(documentId);

      if (!document) {
        return sendError(res, "NOT_FOUND", "Invoice document not found", 404);
      }

      if (document.uploaderUserId !== userId) {
        return sendError(res, "FORBIDDEN", "No access to this document", 403);
      }

      return sendSuccess(res, document);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("invoice.get.failed", { error: message });
      return sendError(res, "INTERNAL_ERROR", message, 500);
    }
  }
);

// GET /invoices - List user's invoices (PROCUREMENT role required)
invoiceRouter.get(
  "/",
  verifyFirebaseToken,
  requireRole("PROCUREMENT", "ADMIN"),
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = req.user?.uid;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

      if (!userId) {
        return sendError(res, "UNAUTHORIZED", "User ID not found in token", 401);
      }

      const documents = await invoiceDocumentService.listInvoiceDocumentsForUser(userId, limit);

      return sendSuccess(res, {
        count: documents.length,
        documents
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("invoice.list.failed", { error: message });
      return sendError(res, "INTERNAL_ERROR", message, 500);
    }
  }
);

// GET /invoices/:documentId/download - Get download URL
invoiceRouter.get(
  "/:documentId/download",
  verifyFirebaseToken,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const { documentId } = req.params;
      const userId = req.user?.uid;

      if (!userId) {
        return sendError(res, "UNAUTHORIZED", "User ID not found in token", 401);
      }

      const document = await invoiceDocumentService.getInvoiceDocument(documentId);

      if (!document) {
        return sendError(res, "NOT_FOUND", "Invoice document not found", 404);
      }

      if (document.uploaderUserId !== userId) {
        return sendError(res, "FORBIDDEN", "No access to this document", 403);
      }

      const downloadUrl = await invoiceDocumentService.getDownloadUrl(documentId);

      return sendSuccess(res, {
        downloadUrl,
        expiresIn: 3600
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("invoice.download.failed", { error: message });
      return sendError(res, "INTERNAL_ERROR", message, 500);
    }
  }
);

// DELETE /invoices/:documentId - Delete document
invoiceRouter.delete(
  "/:documentId",
  verifyFirebaseToken,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const { documentId } = req.params;
      const userId = req.user?.uid;

      if (!userId) {
        return sendError(res, "UNAUTHORIZED", "User ID not found in token", 401);
      }

      const document = await invoiceDocumentService.getInvoiceDocument(documentId);

      if (!document) {
        return sendError(res, "NOT_FOUND", "Invoice document not found", 404);
      }

      if (document.uploaderUserId !== userId) {
        return sendError(res, "FORBIDDEN", "No access to this document", 403);
      }

      await invoiceDocumentService.deleteInvoiceDocument(documentId);

      return sendSuccess(res, {
        message: "Invoice document deleted successfully"
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("invoice.delete.failed", { error: message });
      return sendError(res, "INTERNAL_ERROR", message, 500);
    }
  }
);
