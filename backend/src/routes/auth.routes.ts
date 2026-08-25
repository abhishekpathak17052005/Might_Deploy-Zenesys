import { Router, Request, Response, NextFunction } from "express";
import { userService } from "../services/UserService";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { verifyJWTToken } from "../middleware/auth.middleware";

export const authRouter = Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
authRouter.post("/register", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, confirmPassword, name, role } = req.body;

    // Validate input
    if (!email || !password || !confirmPassword || !name) {
      return sendError(res, "VALIDATION_ERROR", "Missing required fields", 400);
    }

    const result = await userService.register({
      email,
      password,
      confirmPassword,
      name,
      role: role || "PROCUREMENT_OFFICER",
    });

    return sendSuccess(res, result, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed";
    return sendError(res, "REGISTRATION_ERROR", message, 400);
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
authRouter.post("/login", async (req: Request, res: Response, next: NextFunction) => {
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
