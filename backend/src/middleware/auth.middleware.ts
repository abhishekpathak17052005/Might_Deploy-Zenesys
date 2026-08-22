import type { NextFunction, Request, Response } from "express";
import { auth } from "../config/firebase";
import { AppError, forbidden, unauthorized } from "../utils/errors";
import { USER_ROLES, type UserRole } from "../types/user.types";

function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.includes(value as UserRole);
}

export async function verifyFirebaseToken(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.header("Authorization");

    if (!header?.startsWith("Bearer ")) {
      throw unauthorized("Authentication required");
    }

    const token = header.slice("Bearer ".length).trim();

    if (!token) {
      throw unauthorized("Authentication token is missing");
    }

    const decodedToken = await auth.verifyIdToken(token);
    const role = isUserRole(decodedToken.role) ? decodedToken.role : undefined;

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      role
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
