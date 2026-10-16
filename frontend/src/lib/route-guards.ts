import { redirect } from "@tanstack/react-router";
export async function requireRole(roles: string[]) {
  if (typeof window === "undefined") return;
  const token = localStorage.getItem("token") || localStorage.getItem("invoiceflow_token");
  if (!token) throw redirect({ to: "/" });
  const storedRole = localStorage.getItem("userRole") || localStorage.getItem("invoiceflow_role");
  const currentRole = storedRole === "finance" ? "FINANCE_MANAGER"
    : storedRole === "procurement" ? "PROCUREMENT_OFFICER"
      : storedRole === "vendor" ? "VENDOR" : storedRole || undefined;
  if (!currentRole) throw redirect({ to: "/" });
  if (!roles.includes(currentRole)) throw redirect({ to: roleLanding(currentRole) as any });
}

export function roleLanding(role?: string) {
  if (role === "FINANCE_MANAGER" || role === "ORGANIZATION_ADMIN") return "/finance/dashboard";
  if (role === "PROCUREMENT_OFFICER") return "/procurement/dashboard";
  return "/vendor/dashboard";
}
