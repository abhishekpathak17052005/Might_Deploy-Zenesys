/**
 * Centralized API client for all backend communication.
 * Environment-based URL configuration.
 * Single source of truth for API calls.
 */

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// ==================== INVOICE TYPES ====================

export interface InvoiceDocument {
  id: string;
  invoiceNumber: string;
  vendorId: string;
  vendorName?: string;
  documentStatus: string;
  invoiceDate: string;
  totalAmount: number;
  poNumber?: string;
  gstin?: string;
  category?: {
    category: string;
    confidence: number;
  };
  riskResult?: {
    riskScore: number;
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    findings: Array<{ type: string; message: string }>;
  };
  verificationResult?: {
    status: string;
    checks: Record<string, any>;
  };
  submittedAt: string;
  processedAt?: string;
  approvalStatus?: "PENDING" | "APPROVED" | "REJECTED";
  uploaderUserId: string;
  storagePath: string;
  mimeType: string;
  originalFilename: string;
}

export interface UploadedInvoiceResponse {
  id: string;
  storagePath: string;
  documentStatus: string;
  uploadedAt: string;
}

export interface ExtractionResult {
  documentId: string;
  status: string;
  invoice: Record<string, any>;
  category: Record<string, any>;
  extraction: {
    status: string;
    extractedAt: string;
    confidence: number;
    provider: string;
    model: string;
  };
  validation: Record<string, any>;
}

export interface ProcessingResult {
  documentId: string;
  status: string;
  invoice: InvoiceDocument;
  category?: Record<string, any>;
  verificationResult?: Record<string, any>;
  riskResult?: Record<string, any>;
}

export interface ApprovalResponse {
  invoiceId: string;
  decision: "APPROVED" | "REJECTED";
  approverUserId: string;
  decisionTimestamp: string;
  documentStatus: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Make authenticated API request.
   */
  private async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    endpoint: string,
    options?: {
      body?: Record<string, unknown> | FormData;
      token?: string;
    }
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const headers: Record<string, string> = {};

      if (options?.token) {
        headers["Authorization"] = `Bearer ${options.token}`;
      }

      const fetchOptions: RequestInit = {
        method,
        headers
      };

      if (options?.body) {
        if (options.body instanceof FormData) {
          fetchOptions.body = options.body;
        } else {
          headers["Content-Type"] = "application/json";
          fetchOptions.body = JSON.stringify(options.body);
        }
      }

      const response = await fetch(url, fetchOptions);
      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || {
            code: "API_ERROR",
            message: `HTTP ${response.status}`,
            details: data
          }
        };
      }

      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message
        }
      };
    }
  }

  // ==================== INVOICE OPERATIONS ====================

  /**
   * Upload invoice document.
   */
  async uploadInvoice(file: File, token: string, invoiceType: string, vendorId: string) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("invoiceType", invoiceType);
    formData.append("vendorId", vendorId);

    return this.request<UploadedInvoiceResponse>("/invoices/upload", {
      method: "POST",
      body: formData,
      token
    });
  }

  /**
   * Extract invoice document (OCR + categorization).
   */
  async extractInvoice(documentId: string, token: string) {
    return this.request<ExtractionResult>(`/invoices/${documentId}/extract`, {
      method: "POST",
      token
    });
  }

  /**
   * Process invoice through complete verification workflow.
   */
  async processInvoice(documentId: string, token: string) {
    return this.request<ProcessingResult>(`/invoices/${documentId}/process`, {
      method: "POST",
      token
    });
  }

  /**
   * Get invoice detail.
   */
  async getInvoice(documentId: string, token: string) {
    return this.request<InvoiceDocument>(`/invoices/${documentId}`, {
      method: "GET",
      token
    });
  }

  /**
   * List invoices for procurement user.
   */
  async listInvoices(token: string, limit: number = 20) {
    return this.request<{ count: number; documents: InvoiceDocument[] }>(`/invoices?limit=${limit}`, {
      method: "GET",
      token
    });
  }

  /**
   * Get download URL for invoice document.
   */
  async getDownloadUrl(documentId: string, token: string) {
    return this.request<{ downloadUrl: string; expiresIn: number }>(`/invoices/${documentId}/download`, {
      method: "GET",
      token
    });
  }

  /**
   * Delete invoice document.
   */
  async deleteInvoice(documentId: string, token: string) {
    return this.request<{ message: string }>(`/invoices/${documentId}`, {
      method: "DELETE",
      token
    });
  }

  // ==================== FINANCE REVIEW ====================

  /**
   * Get invoices pending finance review.
   */
  async getFinanceReviewQueue(token: string, limit: number = 20) {
    return this.request<{ count: number; invoices: InvoiceDocument[] }>(`/finance/review?limit=${limit}`, {
      method: "GET",
      token
    });
  }

  /**
   * Get full review packet for an invoice.
   */
  async getInvoiceReviewPacket(documentId: string, token: string) {
    return this.request<{
      invoice: InvoiceDocument;
      approval: Record<string, any> | null;
      reviewPacket: Record<string, any>;
    }>(`/finance/invoices/${documentId}`, {
      method: "GET",
      token
    });
  }

  /**
   * Approve invoice.
   */
  async approveInvoice(documentId: string, token: string, comments?: string) {
    return this.request<ApprovalResponse>(`/finance/invoices/${documentId}/approve`, {
      method: "POST",
      body: { comments },
      token
    });
  }

  /**
   * Reject invoice.
   */
  async rejectInvoice(documentId: string, token: string, reason: string) {
    return this.request<ApprovalResponse>(`/finance/invoices/${documentId}/reject`, {
      method: "POST",
      body: { reason },
      token
    });
  }

  /**
   * Get approval stats.
   */
  async getApprovalStats(token: string) {
    return this.request<{
      pending: number;
      approved: number;
      rejected: number;
      totalValue: number;
    }>(`/finance/stats`, {
      method: "GET",
      token
    });
  }

  // ==================== UTILITIES ====================

  /**
   * Check API health.
   */
  async getHealth() {
    return this.request("/health", {
      method: "GET"
    });
  }

  /**
   * Get current user info.
   */
  async getCurrentUser(token?: string) {
    const authToken = token || localStorage.getItem("token");
    return this.request(`/auth/me`, {
      method: "GET",
      token: authToken || undefined
    });
  }
}

export const apiClient = new ApiClient();
