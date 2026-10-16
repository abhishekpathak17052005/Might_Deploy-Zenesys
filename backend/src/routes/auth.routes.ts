import { Router, Request, Response, NextFunction } from "express";
import { userService } from "../services/UserService";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { verifyJWTToken } from "../middleware/auth.middleware";
import { rateLimitMiddleware } from "../middleware/rate-limit.middleware";

export const authRouter = Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
// Public-only roles that may be self-registered
const SELF_REGISTERABLE_ROLES = ["PROCUREMENT_OFFICER", "VENDOR"] as const;

authRouter.post("/register", rateLimitMiddleware(15 * 60 * 1000, 10), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, confirmPassword, name, role } = req.body;

    // Validate input
    if (!email || !password || !confirmPassword || !name) {
      return sendError(res, "VALIDATION_ERROR", "Missing required fields", 400);
    }

    // Security: never allow privileged roles through public registration
    const requestedRole = (role as string || "").toUpperCase();
    if (requestedRole === "ORGANIZATION_ADMIN" || requestedRole === "FINANCE_MANAGER") {
      return sendError(
        res,
        "FORBIDDEN",
        "Privileged roles (ORGANIZATION_ADMIN, FINANCE_MANAGER) cannot be self-registered via public registration",
        403
      );
    }

    if (requestedRole && !SELF_REGISTERABLE_ROLES.includes(requestedRole as any)) {
      return sendError(res, "VALIDATION_ERROR", "Invalid self-registration role", 400);
    }
    const allowedRole: (typeof SELF_REGISTERABLE_ROLES)[number] = requestedRole
      ? (requestedRole as (typeof SELF_REGISTERABLE_ROLES)[number])
      : "VENDOR";

    const result = await userService.register({
      email,
      password,
      confirmPassword,
      name,
      role: allowedRole,
    });

    return sendSuccess(res, result, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed";
    return sendError(res, "REGISTRATION_ERROR", message, 400);
  }
});

/**
 * POST /api/auth/provision-user
 * Administrative provisioning of users (Org Admin only)
 */
authRouter.post(
  "/provision-user",
  verifyJWTToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user || req.user.role !== "ORGANIZATION_ADMIN") {
        return sendError(res, "FORBIDDEN", "Only organization administrators can provision users", 403);
      }

      const { email, password, confirmPassword, name, role } = req.body;
      if (!email || !password || !confirmPassword || !name || !role) {
        return sendError(res, "VALIDATION_ERROR", "Missing required fields for user provisioning", 400);
      }

      const allowedRoles = ["ORGANIZATION_ADMIN", "PROCUREMENT_OFFICER", "FINANCE_MANAGER", "VENDOR"];
      if (!allowedRoles.includes(role)) {
        return sendError(res, "VALIDATION_ERROR", `Invalid role: ${role}`, 400);
      }

      const result = await userService.register({
        email,
        password,
        confirmPassword,
        name,
        role,
        organizationId: req.user.organizationId,
      });

      return sendSuccess(res, result, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : "User provisioning failed";
      return sendError(res, "PROVISIONING_ERROR", message, 400);
    }
  }
);

/**
 * POST /api/auth/login
 * Login user
 */
authRouter.post("/login", rateLimitMiddleware(15 * 60 * 1000, 10), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return sendError(res, "VALIDATION_ERROR", "Email and password are required", 400);
    }

    const result = await userService.login({ email, password });

    return sendSuccess(res, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    return sendError(res, "LOGIN_ERROR", message, 401);
  }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
authRouter.get("/me", verifyJWTToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return sendError(res, "UNAUTHORIZED", "User not found", 401);
    }

    const user = await userService.getUserById(req.user.uid);

    if (!user) {
      return sendError(res, "NOT_FOUND", "User not found", 404);
    }

    return sendSuccess(res, { user });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/auth/profile
 * Update user profile
 */
authRouter.put("/profile", verifyJWTToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return sendError(res, "UNAUTHORIZED", "User not found", 401);
    }

    const { name } = req.body;

    const user = await userService.updateUser(req.user.uid, { name });

    if (!user) {
      return sendError(res, "NOT_FOUND", "User not found", 404);
    }

    return sendSuccess(res, { user });
  } catch (error) {
    next(error);
  }
});

export default authRouter;
