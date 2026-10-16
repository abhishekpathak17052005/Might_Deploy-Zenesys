import { v4 as uuidv4 } from "uuid";
import mongoose from "mongoose";
import type { InvoiceCategorization } from "../categorization";
import type { ExtractionResult } from "../extraction";
import type { InvoiceDocument, InvoiceType } from "./invoice.types";
import { InvoiceDocumentModel } from "../../models/InvoiceDocument";

export class InvoiceDocumentService {
  private documents = new Map<string, InvoiceDocument>();
  private fileBuffers = new Map<string, Buffer>();

  /**
   * Upload an invoice document file and persist to MongoDB.
   */
  async uploadInvoiceDocument(
    fileBuffer: Buffer,
    originalFilename: string,
    mimeType: string,
    uploaderUserId: string,
    invoiceType: InvoiceType,
    vendorId?: string
  ): Promise<InvoiceDocument> {
    // Validate MIME type
    const validMimeTypes = ["application/pdf", "image/jpeg", "image/png", "image/tiff", "image/webp"];
    if (!validMimeTypes.includes(mimeType)) {
      throw new Error(
        `Invalid file type: ${mimeType}. Allowed types: ${validMimeTypes.join(", ")}`
      );
    }

    // Validate file size (max 10MB)
    const maxFileSizeBytes = 10 * 1024 * 1024;
    if (fileBuffer.length > maxFileSizeBytes) {
      throw new Error(
        `File too large: ${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB. Maximum allowed: ${maxFileSizeBytes / 1024 / 1024}MB`
      );
    }

    const documentId = uuidv4();
    const fileExtension = this.getFileExtension(originalFilename);
    const storagePath = `invoices/${uploaderUserId}/${documentId}/${documentId}${fileExtension}`;

    this.fileBuffers.set(storagePath, fileBuffer);

    const now = new Date();
    const invoiceDocument: InvoiceDocument = {
      id: documentId,
      invoiceNumber: null,
      uploaderUserId,
      vendorId: vendorId || null,
      invoiceType,
      documentStatus: "SUBMITTED",
      storagePath,
      originalFilename,
      mimeType,
      fileSizeBytes: fileBuffer.length,
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
      metadata: {
        extractionAttempts: 0
      }
    };

    this.documents.set(documentId, invoiceDocument);

    // Durable persistence to MongoDB
    if (mongoose.connection.readyState === 1) {
      try {
        await InvoiceDocumentModel.create({
          ...invoiceDocument,
          fileData: fileBuffer,
        });
      } catch (err) {
        console.error("invoice.document.mongo_persist_failed", {
          documentId,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    console.info("invoice.document.uploaded", {
      documentId,
      uploaderUserId,
      storagePath,
      fileSizeBytes: fileBuffer.length,
      invoiceType
    });

    return invoiceDocument;
  }

  /**
   * Get an invoice document by ID.
   */
  async getInvoiceDocument(documentId: string): Promise<InvoiceDocument | null> {
    // Check in-memory cache first
    const cached = this.documents.get(documentId);
    if (cached) return cached;

    // Check MongoDB
    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await InvoiceDocumentModel.findOne({ id: documentId });
        if (doc) {
          const formatted: InvoiceDocument = doc.toObject();
          this.documents.set(documentId, formatted);
          return formatted;
        }
      } catch (err) {
        console.error("invoice.document.mongo_fetch_failed", {
          documentId,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return null;
  }

  /**
   * List invoice documents for a user.
   */
  async listInvoiceDocumentsForUser(
    uploaderUserId: string,
    limit: number = 20
  ): Promise<InvoiceDocument[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await InvoiceDocumentModel.find({ uploaderUserId })
          .sort({ submittedAt: -1 })
          .limit(limit);

        if (docs.length > 0) {
          return docs.map((d) => d.toObject());
        }
      } catch (err) {
        console.error("invoice.document.mongo_list_failed", {
          uploaderUserId,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const userDocs = Array.from(this.documents.values())
      .filter((doc) => doc.uploaderUserId === uploaderUserId)
      .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())
      .slice(0, limit);

    return userDocs;
  }

  /**
   * Update document status (used after extraction).
   */
  async updateDocumentStatus(
    documentId: string,
    newStatus: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const doc = this.documents.get(documentId);
    if (doc) {
      doc.documentStatus = newStatus as any;
      doc.updatedAt = new Date();
      if (metadata) {
        doc.metadata = { ...(doc.metadata ?? {}), ...metadata };
      }
    }

    if (mongoose.connection.readyState === 1) {
      try {
        await InvoiceDocumentModel.findOneAndUpdate(
          { id: documentId },
          {
            $set: {
              documentStatus: newStatus,
              updatedAt: new Date(),
              ...(metadata ? { metadata } : {}),
            },
          }
        );
      } catch (err) {
        console.error("invoice.document.mongo_update_failed", {
          documentId,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }
  }

  /**
   * Download the original invoice bytes for extraction.
   */
  async getDocumentBuffer(document: InvoiceDocument): Promise<Buffer> {
    const buffer = this.fileBuffers.get(document.storagePath);
    if (buffer && buffer.length > 0) {
      return buffer;
    }

    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await InvoiceDocumentModel.findOne({ id: document.id }).select("+fileData");
        if (doc && doc.fileData) {
          this.fileBuffers.set(document.storagePath, doc.fileData);
          return doc.fileData;
        }
      } catch (err) {
        console.error("invoice.document.mongo_buffer_fetch_failed", {
          documentId: document.id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return Buffer.from("");
  }

  /**
   * Persist extraction result on invoice document.
   */
  async persistExtractionResult(
    document: InvoiceDocument,
    extraction: ExtractionResult,
    category: InvoiceCategorization,
    attempts: number
  ): Promise<void> {
    const doc = this.documents.get(document.id) ?? document;
    const metadata = {
      ...(doc.metadata ?? {}),
      extractionAttempts: attempts,
      lastExtractionAt: extraction.extractedAt.toISOString(),
      extractionProvider: extraction.provider,
      extractionModel: extraction.model
    };

    const updatePayload = {
      documentStatus: "EXTRACTION_COMPLETE",
      invoiceNumber: extraction.invoice.invoiceNumber,
      vendorName: extraction.invoice.vendorName,
      gstin: extraction.invoice.gstin ?? null,
      poNumber: extraction.invoice.poNumber ?? null,
      invoiceDate: extraction.invoice.invoiceDate,
      dueDate: extraction.invoice.dueDate ?? null,
      subtotal: extraction.invoice.subtotal,
      taxAmount: extraction.invoice.tax,
      totalAmount: extraction.invoice.total,
      currency: "INR",
      lineItems: extraction.invoice.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate ?? null,
        total: item.amount
      })),
      rawExtractionResult: extraction.raw,
      extractionConfidence: extraction.confidence,
      extractionValidation: extraction.validation,
      extractedAt: extraction.extractedAt,
      extractionProvider: {
        provider: extraction.provider,
        model: extraction.model
      },
      category,
      updatedAt: new Date(),
      metadata
    };

    Object.assign(doc, updatePayload);
    this.documents.set(doc.id, doc);

    if (mongoose.connection.readyState === 1) {
      try {
        await InvoiceDocumentModel.findOneAndUpdate(
          { id: doc.id },
          { $set: updatePayload }
        );
      } catch (err) {
        console.error("invoice.document.mongo_persist_extraction_failed", {
          documentId: doc.id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }
  }

  /**
   * Persist a controlled extraction failure.
   */
  async markExtractionFailed(
    document: InvoiceDocument,
    safeError: string,
    attempts: number
  ): Promise<void> {
    const doc = this.documents.get(document.id) ?? document;
    doc.documentStatus = "EXTRACTION_FAILED" as any;
    doc.updatedAt = new Date();
    doc.metadata = {
      ...(doc.metadata ?? {}),
      extractionAttempts: attempts,
      lastExtractionError: safeError
    };
    this.documents.set(doc.id, doc);

    if (mongoose.connection.readyState === 1) {
      try {
        await InvoiceDocumentModel.findOneAndUpdate(
          { id: doc.id },
          {
            $set: {
              documentStatus: "EXTRACTION_FAILED",
              updatedAt: new Date(),
              metadata: doc.metadata,
            },
          }
        );
      } catch (err) {
        console.error("invoice.document.mongo_mark_failed_error", {
          documentId: doc.id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }
  }

  /**
   * Delete an invoice document.
   */
  async deleteInvoiceDocument(documentId: string): Promise<void> {
    const doc = await this.getInvoiceDocument(documentId);
    if (!doc) {
      throw new Error(`Document not found: ${documentId}`);
    }

    this.fileBuffers.delete(doc.storagePath);
    this.documents.delete(documentId);

    if (mongoose.connection.readyState === 1) {
      try {
        await InvoiceDocumentModel.deleteOne({ id: documentId });
      } catch (err) {
        console.error("invoice.document.mongo_delete_failed", {
          documentId,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    console.info("invoice.document.deleted", {
      documentId,
      storagePath: doc.storagePath
    });
  }

  /**
   * Get download URL for a document.
   */
  async getDownloadUrl(documentId: string): Promise<string> {
    const doc = await this.getInvoiceDocument(documentId);
    if (!doc) {
      throw new Error(`Document not found: ${documentId}`);
    }
    return `/api/invoices/${documentId}/download`;
  }

  private getFileExtension(filename: string): string {
    const match = filename.match(/\.[^.]*$/);
    return match ? match[0] : "";
  }
}

export const invoiceDocumentService = new InvoiceDocumentService();
