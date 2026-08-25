import { useEffect, useState } from "react";
import { apiClient, type InvoiceDocument } from "@/lib/api";

interface UseInvoicesOptions {
  enabled?: boolean;
}

export function useInvoices(options?: UseInvoicesOptions) {
  const [invoices, setInvoices] = useState<InvoiceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (options?.enabled === false) return;

    const fetchInvoices = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("firebaseToken");
        if (!token) {
          setError("No authentication token");
          return;
        }

        const result = await apiClient.listInvoices(token);
        if (result.success && result.data) {
          setInvoices(result.data.documents);
          setError(null);
        } else {
          setError(result.error?.message || "Failed to fetch invoices");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchInvoices();
  }, [options?.enabled]);

  return { invoices, loading, error };
}

export function useInvoiceDetail(invoiceId: string | null) {
  const [invoice, setInvoice] = useState<InvoiceDocument | null>(null);
  const [loading, setLoading] = useState(!!invoiceId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!invoiceId) {
      setInvoice(null);
      setLoading(false);
      return;
    }

    const fetchInvoice = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("firebaseToken");
        if (!token) {
          setError("No authentication token");
          return;
        }

        const result = await apiClient.getInvoice(invoiceId, token);
        if (result.success && result.data) {
          setInvoice(result.data);
          setError(null);
        } else {
          setError(result.error?.message || "Failed to fetch invoice");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [invoiceId]);

  return { invoice, loading, error };
}

export function useReviewQueue() {
  const [invoices, setInvoices] = useState<InvoiceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQueue = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("firebaseToken");
        if (!token) {
          setError("No authentication token");
          return;
        }

        const result = await apiClient.getFinanceReviewQueue(token);
        if (result.success && result.data) {
          setInvoices(result.data.invoices);
          setError(null);
        } else {
          setError(result.error?.message || "Failed to fetch review queue");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchQueue();
  }, []);

  return { invoices, loading, error };
}
