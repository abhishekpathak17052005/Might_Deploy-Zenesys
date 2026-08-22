export const USER_ROLES = [
  "ADMIN",
  "EMPLOYEE",
  "PROCUREMENT",
  "AP_EXECUTIVE",
  "FINANCE_MANAGER",
  "CFO"
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  name?: string;
  role?: UserRole;
}
