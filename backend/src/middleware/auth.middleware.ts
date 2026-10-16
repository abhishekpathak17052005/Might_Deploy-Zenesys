import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { verifyToken } from "../config/jwt";
import { AppError, forbidden, unauthorized } from "../utils/errors";
import { User } from "../models/User";

export type UserRole = "ORGANIZATION_ADMIN" | "PROCUREMENT_OFFICER" | "FINANCE_MANAGER" | "VENDOR";

declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        userId?: string;
        email: string;
        name: string;
        role?: UserRole;
        organizationId?: string;
        vendorId?: string;
      };
    }
  }
}

function isUserRole(value: unknown): value is UserRole {
  const roles: UserRole[] = ["ORGANIZATION_ADMIN", "PROCUREMENT_OFFICER", "FINANCE_MANAGER", "VENDOR"];
  return typeof value === "string" && roles.includes(value as UserRole);
}

export async function verifyJWTToken(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.header("Authorization");

    if (!header?.startsWith("Bearer ")) {
      throw unauthorized("Authentication required");
    }

    const token = header.slice("Bearer ".length).trim();

    if (!token) {
      throw unauthorized("Authentication token is missing");
    }

    const decodedToken = verifyToken(token);
    let role = isUserRole(decodedToken.role) ? decodedToken.role : undefined;
    let organizationId = decodedToken.organizationId;
    let vendorId = decodedToken.vendorId;
    let name = decodedToken.email ? decodedToken.email.split("@")[0] : "User";

    // When MongoDB is connected, verify user state in database (disabled user, role changes, deletion)
    if (mongoose.connection.readyState === 1 && decodedToken.userId && mongoose.Types.ObjectId.isValid(decodedToken.userId)) {
      const user = await User.findById(decodedToken.userId).select("isActive role organizationId vendorId email name");
      if (!user) {
        throw unauthorized("User account not found or removed");
      }
      if (user.isActive === false) {
        throw unauthorized("User account is disabled");
      }
      if (user.role && isUserRole(user.role)) {
        role = user.role;
      }
      if (user.organizationId) {
        organizationId = user.organizationId.toString();
      }
      if (user.vendorId) {
        vendorId = user.vendorId.toString();
      }
      if (user.name) {
        name = user.name;
      }
    }

    req.user = {
      uid: decodedToken.userId,
      userId: decodedToken.userId,
      email: decodedToken.email,
      name,
      role,
      organizationId,
      vendorId,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    next(unauthorized("Invalid or expired authentication token"));
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(unauthorized("Authentication required"));
      return;
    }

    if (!req.user.role || !allowedRoles.includes(req.user.role)) {
      next(forbidden("Insufficient permissions"));
      return;
    }

    next();
  };
}

/**
 * Enforce organization isolation
 * Verifies that user's organizationId matches the requested organization
 */
export function requireOrganization(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw unauthorized("Authentication required");
    }

    // Extract organizationId from request (could be in params, query, or body)
    const requestedOrgId = req.params.organizationId || req.query.organizationId || (req.body?.organizationId as string);

    if (!requestedOrgId) {
      throw forbidden("Organization ID is required");
    }

    // VENDOR users don't have organizationId in token - they serve multiple orgs
    // So we allow vendors through (they'll be further restricted in service layer)
    if (req.user.role === "VENDOR") {
      next();
      return;
    }

    // All other roles must have organizationId in token and it must match
    if (!req.user.organizationId) {
      throw unauthorized("User is not associated with an organization");
    }

    if (req.user.organizationId !== requestedOrgId) {
      throw forbidden("You do not have access to this organization");
    }

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    next(forbidden("Organization access denied"));
  }
}

/**
 * Middleware to attach organization context to request
 */
export function attachOrganizationContext(req: Request, _res: Response, next: NextFunction) {
  if (req.user) {
    req.organizationId = req.user.organizationId || (req.params.organizationId as string);
  }
  next();
}

declare global {
  namespace Express {
    interface Request {
      organizationId?: string;
    }
  }
}
