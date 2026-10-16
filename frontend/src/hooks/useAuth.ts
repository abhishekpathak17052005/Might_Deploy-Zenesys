import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";

export interface AuthUser {
  uid: string;
  email: string | null;
  role: "PROCUREMENT_OFFICER" | "FINANCE_MANAGER" | "ORGANIZATION_ADMIN" | "VENDOR";
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      // Check if JWT token exists
      const token = localStorage.getItem("token");
      if (!token) { setUser(null); return; }
      void apiClient.getCurrentUser(token).then((result) => {
        const current = (result.data as any)?.user;
        if (!result.success || !current) { setUser(null); return; }
        setUser({ uid: current._id || current.id, email: current.email, role: current.role });
      }).catch((err) => setError(err instanceof Error ? err.message : "Auth error"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auth error");
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = async () => {
    try {
      setUser(null);
      localStorage.removeItem("token");
      localStorage.removeItem("userEmail");
      localStorage.removeItem("userId");
      localStorage.removeItem("userRole");
      localStorage.removeItem("invoiceflow_token");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logout failed");
    }
  };

  return { user, loading, error, logout };
}
