import { v4 as uuidv4 } from "uuid";
import { COLLECTIONS } from "../../config/constants";
import { firestore, storage } from "../../config/firebase";
import type { InvoiceDocument, InvoiceType } from "./invoice.types";

export class InvoiceDocumentService {
  /**
   * Upload an invoice document file to Firebase Storage and create a Firestore document.
   * 
   * @param fileBuffer - The file buffer from multipart upload
   * @param originalFilename - Original filename from upload
   * @param mimeType - MIME type of the file
   * @param uploaderUserId - Firebase UID of the user uploading
   * @param invoiceType - Type of invoice (PO_BASED or NON_PO)
   * @param vendorId - Optional vendor ID
   * @returns Created InvoiceDocument
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

    // Generate unique document ID and storage path
    const documentId = uuidv4();
    const fileExtension = this.getFileExtension(originalFilename);
    const storagePath = `invoices/${uploaderUserId}/${documentId}/${documentId}${fileExtension}`;

    try {
      // Upload file to Firebase Storage
      const bucket = storage.bucket();
      const file = bucket.file(storagePath);

      await file.save(fileBuffer, {
        metadata: {
          contentType: mimeType,
          metadata: {
            documentId,
            uploaderUserId,
            originalFilename,
            uploadedAt: new Date().toISOString()
          }
        }
      });

      // Create Firestore document for invoice
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

      await firestore.collection(COLLECTIONS.invoiceDocuments).doc(documentId).set(invoiceDocument);

      console.info("invoice.document.uploaded", {
        documentId,
        uploaderUserId,
        storagePath,
        fileSizeBytes: fileBuffer.length,
        invoiceType
      });

      return invoiceDocument;
    } catch (error) {
      // Clean up: delete uploaded file if Firestore write fails
      const bucket = storage.bucket();
      const file = bucket.file(storagePath);
      
      try {
        await file.delete();
      } catch (deleteError) {
        console.error("invoice.document.cleanup_failed", {
          documentId,
          storagePath,
          error: deleteError instanceof Error ? deleteError.message : "Unknown error"
        });
      }

      throw error;
    }
  }

  /**
   * Get an invoice document by ID.
   */
  async getInvoiceDocument(documentId: string): Promise<InvoiceDocument | null> {
    const doc = await firestore.collection(COLLECTIONS.invoiceDocuments).doc(documentId).get();
    
    if (!doc.exists) {
      return null;
    }

    return doc.data() as InvoiceDocument;
  }

  /**
   * List invoice documents for a user.
   */
  async listInvoiceDocumentsForUser(
    uploaderUserId: string,
    limit: number = 20
  ): Promise<InvoiceDocument[]> {
    const snapshot = await firestore
      .collection(COLLECTIONS.invoiceDocuments)
      .where("uploaderUserId", "==", uploaderUserId)
      .orderBy("submittedAt", "desc")
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => doc.data() as InvoiceDocument);
  }

  /**
   * Update document status (used after extraction).
   */
  async updateDocumentStatus(
    documentId: string,
    newStatus: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await firestore
      .collection(COLLECTIONS.invoiceDocuments)
      .doc(documentId)
      .update({
        documentStatus: newStatus,
        updatedAt: new Date(),
        ...(metadata && { metadata })
      });
  }

  /**
   * Delete an invoice document (both storage and Firestore).
   */
  async deleteInvoiceDocument(documentId: string): Promise<void> {
    const doc = await this.getInvoiceDocument(documentId);
    
    if (!doc) {
      throw new Error(`Document not found: ${documentId}`);
    }

    try {
      // Delete from storage
      const bucket = storage.bucket();
      const file = bucket.file(doc.storagePath);
      await file.delete();

      // Delete from Firestore
      await firestore.collection(COLLECTIONS.invoiceDocuments).doc(documentId).delete();

      console.info("invoice.document.deleted", {
        documentId,
        storagePath: doc.storagePath
      });
    } catch (error) {
      console.error("invoice.document.deletion_failed", {
        documentId,
        error: error instanceof Error ? error.message : "Unknown error"
      });
      throw error;
    }
  }

  /**
   * Get download URL for a document (valid for 1 hour).
   */
  async getDownloadUrl(documentId: string): Promise<string> {
    const doc = await this.getInvoiceDocument(documentId);
    
    if (!doc) {
      throw new Error(`Document not found: ${documentId}`);
    }

    const bucket = storage.bucket();
    const file = bucket.file(doc.storagePath);
    
    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 60 * 60 * 1000 // 1 hour
    });

    return url;
  }

  /**
   * Extract file extension from filename.
   */
  private getFileExtension(filename: string): string {
    const match = filename.match(/\.[^.]*$/);
    return match ? match[0] : "";
  }
}

export const invoiceDocumentService = new InvoiceDocumentService();
