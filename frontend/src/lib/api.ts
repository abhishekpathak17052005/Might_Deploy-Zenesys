/**
 * Centralized API client for all backend communication.
 * Environment-based URL configuration.
 * Single source of truth for API calls.
 */

const API_URL = import.meta.env["VITE_API_URL"] || "http://localhost:5000/api";

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

/**
 * vendorId may be a plain ID string (InvoiceDocument collection)
 * or a populated object {_id, name, gstin} (Invoice collection via populate).
 * Always use resolveVendorName() to get a display string.
 */
export type PopulatedVendor = { _id: string; name: string; gstin?: string };

export function resolveVendorName(inv: {
  vendorId?: string | PopulatedVendor | null;
  vendorName?: string | null;
}): string {
  if (inv.vendorName) return inv.vendorName;
  if (inv.vendorId && typeof inv.vendorId === "object" && inv.vendorId.name) {
    return inv.vendorId.name;
  }
  return "Unknown Vendor";
}

export interface InvoiceDocument {
  id: string;
  _id?: string;
  invoiceNumber: string;
  vendorId: string | PopulatedVendor;
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
    arg1: "GET" | "POST" | "PUT" | "DELETE" | string,
    arg2?: string | { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: Record<string, unknown> | FormData; token?: string },
    arg3?: { body?: Record<string, unknown> | FormData; token?: string }
  ): Promise<ApiResponse<T>> {
    try {
      let httpMethod: "GET" | "POST" | "PUT" | "DELETE" = "GET";
      let endpoint = "";
      let options: { body?: Record<string, unknown> | FormData; token?: string } | undefined;

      if (arg1 === "GET" || arg1 === "POST" || arg1 === "PUT" || arg1 === "DELETE") {
        httpMethod = arg1;
        endpoint = typeof arg2 === "string" ? arg2 : "";
        options = arg3;
      } else {
        endpoint = arg1;
        if (arg2 && typeof arg2 === "object") {
          httpMethod = arg2.method || "GET";
          options = arg2;
        }
      }

      const url = `${this.baseUrl}${endpoint}`;
      const headers: Record<string, string> = {};

      const token =
        (options?.token && options.token.trim() !== "")
          ? options.token
          : typeof window !== "undefined"
            ? localStorage.getItem("token") || localStorage.getItem("invoiceflow_token") || ""
            : "";

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const fetchOptions: RequestInit = {
        method: httpMethod,
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

  async login(email: string, password: string) {
    return this.request<{ token: string; userId: string; user: { _id: string; id?: string; email: string; role: string } }>("POST", "/auth/login", { body: { email, password } });
  }

  async register(input: { name: string; email: string; password: string; confirmPassword: string; role?: string }) {
    const endpoint = input.role === "VENDOR" ? "/vendor/register" : "/auth/register";
    return this.request<{ token: string; userId?: string; user: { _id: string; id?: string; email: string; role: string }; vendor?: { _id: string } }>("POST", endpoint, { body: input });
  }

  /**
   * Upload invoice document.
   */
  async uploadInvoice(file: File, token: string, invoiceType: string, vendorId: string) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("invoiceType", invoiceType);
    formData.append("vendorId", vendorId);

    return this.request<UploadedInvoiceResponse>("POST", "/invoices/upload", {
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
    return this.request<{ count: number; total?: number; documents?: InvoiceDocument[]; invoices?: InvoiceDocument[] }>(`/invoices?limit=${limit}`, {
      method: "GET",
      token
    });
  }

  async listProcurementPending(token: string, limit: number = 20) {
    return this.request<{ invoices: InvoiceDocument[]; total: number }>(`/invoices/procurement/pending?limit=${limit}`, {
      method: "GET",
      token,
    });
  }

  async getProcurementReview(documentId: string, token: string) {
    return this.request<{
      invoice: Record<string, any>;
      outstandingAmount: number;
      outstandingInvoices: Array<{ _id: string; invoiceNumber?: string; totalAmount?: number; dueDate?: string }>;
    }>(`/invoices/${documentId}/procurement-review`, { method: "GET", token });
  }

  async verifyProcurementInvoice(documentId: string, token: string, reviewConfirmed = false) {
    return this.request<{ invoice: InvoiceDocument }>(`/invoices/${documentId}/procurement/verify`, {
      method: "POST",
      body: { reviewConfirmed },
      token,
    });
  }

  async returnProcurementInvoice(documentId: string, token: string, reason: string) {
    return this.request<{ invoice: InvoiceDocument }>(`/invoices/${documentId}/procurement/return`, {
      method: "POST",
      body: { reason },
      token,
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
  async getApprovalStats(_token?: string) {
    const authToken = _token || localStorage.getItem("token");
    return this.request<{
      pending: number;
      approved: number;
      rejected: number;
      totalValue: number;
    }>("GET", "/finance/stats", {
      ...(authToken ? { token: authToken } : {})
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
      ...(authToken ? { token: authToken } : {})
    });
  }
}

export const apiClient = new ApiClient();
