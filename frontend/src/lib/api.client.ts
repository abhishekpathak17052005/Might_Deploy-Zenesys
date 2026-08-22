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

  // ==================== INVOICE PROCESSING ====================

  /**
   * Process invoice through verification workflow.
   */
  async processInvoice(documentId: string, token: string) {
    return this.request(`/invoices/${documentId}/process`, {
      method: "POST",
      token
    });
  }

  /**
   * Upload invoice document.
   */
  async uploadInvoice(file: File, token: string) {
    const formData = new FormData();
    formData.append("file", file);

    return this.request("/invoices/upload", {
      method: "POST",
      body: formData,
      token
    });
  }

  // ==================== FINANCE REVIEW ====================

  /**
   * Get invoices pending finance review.
   */
  async getFinanceReviewQueue(token: string, filters?: { riskLevel?: string }) {
    const url = new URL(`${this.baseUrl}/finance/review`);
    if (filters?.riskLevel) {
      url.searchParams.append("riskLevel", filters.riskLevel);
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    return response.json();
  }

  /**
   * Get invoice detail with all verification results.
   */
  async getInvoiceDetail(documentId: string, token: string) {
    return this.request(`/finance/invoices/${documentId}`, {
      method: "GET",
      token
    });
  }

  /**
   * Get invoice processing result.
   */
  async getProcessingResult(documentId: string, token: string) {
    return this.request(`/invoices/${documentId}/processing-result`, {
      method: "GET",
      token
    });
  }

  // ==================== APPROVAL WORKFLOW ====================

  /**
   * Approve invoice.
   */
  async approveInvoice(documentId: string, token: string, comments?: string) {
    return this.request(`/invoices/${documentId}/approve`, {
      method: "POST",
      body: { comments },
      token
    });
  }

  /**
   * Reject invoice.
   */
  async rejectInvoice(documentId: string, reason: string, token: string) {
    return this.request(`/invoices/${documentId}/reject`, {
      method: "POST",
      body: { reason },
      token
    });
  }

  // ==================== PROCUREMENT ====================

  /**
   * Get procurement dashboard data.
   */
  async getProcurementDashboard(token: string) {
    return this.request("/procurement/dashboard", {
      method: "GET",
      token
    });
  }

  /**
   * Get list of invoices submitted by procurement officer.
   */
  async getSubmittedInvoices(token: string, filters?: { status?: string }) {
    const url = new URL(`${this.baseUrl}/procurement/invoices`);
    if (filters?.status) {
      url.searchParams.append("status", filters.status);
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    return response.json();
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
  async getCurrentUser(token: string) {
    return this.request("/auth/me", {
      method: "GET",
      token
    });
  }
}

export const apiClient = new ApiClient();
