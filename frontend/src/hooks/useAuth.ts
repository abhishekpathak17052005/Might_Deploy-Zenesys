import { useEffect, useState } from "react";

export interface AuthUser {
  uid: string;
  email: string | null;
  role: "PROCUREMENT" | "FINANCE_MANAGER" | "ADMIN";
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      // Check if JWT token exists
      const token = localStorage.getItem("token");
      const userEmail = localStorage.getItem("userEmail");
      const userId = localStorage.getItem("userId");

      if (token && userEmail && userId) {
        // Determine role from email
        const role = userEmail.includes("finance")
          ? "FINANCE_MANAGER"
          : "PROCUREMENT";

        setUser({
          uid: userId,
          email: userEmail,
          role: role as AuthUser["role"]
        });
      } else {
        setUser(null);
      }
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logout failed");
    }
  };

  return { user, loading, error, logout };
}
