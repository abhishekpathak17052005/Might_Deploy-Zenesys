import express, { type Request, type Response } from "express";
import multer, { type MulterError } from "multer";
import { z } from "zod";
import { verifyFirebaseToken, requireRole } from "../../middleware/auth.middleware";
import { sendError, sendSuccess } from "../../utils/apiResponse";
import { auditService } from "../audit";
import { categorizationService } from "../categorization";
import { extractionService } from "../extraction";
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

function safeExtractionError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return "Gemini extraction did not match the required invoice JSON schema.";
  }

  if (error instanceof Error && error.message.includes("configured")) {
    return "Invoice extraction provider is not configured.";
  }

  if (error instanceof Error && error.message.includes("malformed JSON")) {
    return "Gemini extraction returned malformed JSON.";
  }

  return "Invoice extraction failed.";
}

async function createAuditEvent(input: {
  userId: string;
  action: string;
  entityId: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await auditService.createAuditLog({
      userId: input.userId,
      action: input.action,
      entityType: "INVOICE",
      entityId: input.entityId,
      details: input.details
    });
  } catch (error) {
    console.error("audit.invoice_phase3.failed", {
      action: input.action,
      entityId: input.entityId,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

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

// POST /invoices/:documentId/extract - Extract, validate, and categorize an invoice document
invoiceRouter.post(
  "/:documentId/extract",
  verifyFirebaseToken,
  requireRole("PROCUREMENT", "ADMIN"),
  async (req: Request, res: Response): Promise<Response> => {
    const { documentId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return sendError(res, "UNAUTHORIZED", "User ID not found in token", 401);
    }

    const document = await invoiceDocumentService.getInvoiceDocument(documentId);

    if (!document) {
      return sendError(res, "NOT_FOUND", "Invoice document not found", 404);
    }

    if (document.uploaderUserId !== userId && req.user?.role !== "ADMIN") {
      return sendError(res, "FORBIDDEN", "No access to this document", 403);
    }

    const attempts = (document.metadata?.extractionAttempts ?? 0) + 1;

    try {
      await invoiceDocumentService.updateDocumentStatus(documentId, "EXTRACTION_IN_PROGRESS", {
        ...(document.metadata ?? {}),
        extractionAttempts: attempts
      });

      await createAuditEvent({
        userId,
        action: "INVOICE_EXTRACTION_STARTED",
        entityId: documentId,
        details: {
          attempt: attempts,
          mimeType: document.mimeType,
          timestamp: new Date().toISOString()
        }
      });

      const documentBuffer = await invoiceDocumentService.getDocumentBuffer(document);
      if (documentBuffer.length === 0) {
        throw new Error("Invoice document is empty");
      }

      const extraction = await extractionService.extract({
        documentBuffer,
        mimeType: document.mimeType,
        filename: document.originalFilename
      });

      const category = await categorizationService.categorize(extraction.invoice).catch((error) => {
        console.error("invoice.categorization.failed", {
          documentId,
          error: error instanceof Error ? error.message : "Unknown error"
        });

        return {
          category: "Other" as const,
          confidence: 0,
          reason: "Categorization failed after extraction.",
          status: "FAILED" as const,
          provider: "gemini" as const,
          model: process.env.GEMINI_CATEGORIZATION_MODEL ?? process.env.GEMINI_EXTRACTION_MODEL ?? "gemini-1.5-flash",
          categorizedAt: new Date()
        };
      });
      await invoiceDocumentService.persistExtractionResult(document, extraction, category, attempts);

      await createAuditEvent({
        userId,
        action: "INVOICE_EXTRACTION_COMPLETED",
        entityId: documentId,
        details: {
          validationStatus: extraction.validation.status,
          findingsCount: extraction.validation.findings.length,
          timestamp: new Date().toISOString()
        }
      });

      await createAuditEvent({
        userId,
        action: "INVOICE_CATEGORIZED",
        entityId: documentId,
        details: {
          category: category.category,
          confidence: category.confidence,
          status: category.status,
          timestamp: new Date().toISOString()
        }
      });

      return sendSuccess(res, {
        documentId,
        status: "EXTRACTION_COMPLETE",
        invoice: extraction.invoice,
        category,
        extraction: {
          status: "EXTRACTION_COMPLETE",
          extractedAt: extraction.extractedAt.toISOString(),
          confidence: extraction.confidence,
          provider: extraction.provider,
          model: extraction.model
        },
        validation: extraction.validation
      });
    } catch (error) {
      const safeError = safeExtractionError(error);
      console.error("invoice.extraction.failed", {
        documentId,
        error: error instanceof Error ? error.message : "Unknown error"
      });

      await invoiceDocumentService.markExtractionFailed(document, safeError, attempts);
      await createAuditEvent({
        userId,
        action: "INVOICE_EXTRACTION_FAILED",
        entityId: documentId,
        details: {
          error: safeError,
          attempt: attempts,
          timestamp: new Date().toISOString()
        }
      });

      return sendError(res, "EXTRACTION_FAILED", safeError, 422);
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
