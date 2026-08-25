import { Router, Request, Response, NextFunction } from "express";
import { organizationService } from "../services/OrganizationService";
import { verifyJWTToken, requireRole, requireOrganization } from "../middleware/auth.middleware";
import { AppError, badRequest, forbidden, notFound } from "../utils/errors";

const router = Router();

/**
 * POST /api/organizations
 * Create a new organization (internal admin use only for now)
 * Body: CreateOrganizationInput
 */
router.post(
  "/",
  verifyJWTToken,
  requireRole("ORGANIZATION_ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body;

      // Validate required fields
      if (
        !input.name ||
        !input.email ||
        !input.officialEmail ||
        !input.officialPassword ||
        !input.procurementOfficerEmail ||
        !input.procurementOfficerPassword ||
        !input.financeManagerEmail ||
        !input.financeManagerPassword
      ) {
        throw badRequest("Missing required fields for organization creation");
      }

      const organization = await organizationService.createOrganization(input);

      res.status(201).json({
        success: true,
        data: organization,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/organizations/:organizationId
 * Get organization by ID
 */
router.get(
  "/:organizationId",
  verifyJWTToken,
  requireOrganization,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { organizationId } = req.params;

      const organization = await organizationService.getOrganizationById(organizationId);

      if (!organization) {
        throw notFound("Organization not found");
      }

      res.status(200).json({
        success: true,
        data: organization,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/organizations/:organizationId
 * Update organization (only ORGANIZATION_ADMIN)
 */
router.put(
  "/:organizationId",
  verifyJWTToken,
  requireRole("ORGANIZATION_ADMIN"),
  requireOrganization,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { organizationId } = req.params;
      const updates = req.body;

      const organization = await organizationService.updateOrganization(organizationId, updates);

      if (!organization) {
        throw notFound("Organization not found");
      }

      res.status(200).json({
        success: true,
        data: organization,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/organizations/:organizationId/members
 * Get all members of an organization
 */
router.get(
  "/:organizationId/members",
  verifyJWTToken,
  requireOrganization,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { organizationId } = req.params;
      const { role } = req.query;

      const members = await organizationService.getOrganizationUsers(
        organizationId,
        role as string | undefined
      );

      res.status(200).json({
        success: true,
        data: {
          count: members.length,
          members,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/organizations/:organizationId/stats
 * Get organization statistics
 */
router.get(
  "/:organizationId/stats",
  verifyJWTToken,
  requireOrganization,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { organizationId } = req.params;

      const stats = await organizationService.getOrganizationStats(organizationId);

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/organizations/:organizationId/members
 * Add a user to an organization (only ORGANIZATION_ADMIN)
 */
router.post(
  "/:organizationId/members",
  verifyJWTToken,
  requireRole("ORGANIZATION_ADMIN"),
  requireOrganization,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { organizationId } = req.params;
      const { userId, role } = req.body;

      if (!userId || !role) {
        throw badRequest("Missing userId or role");
      }

      const user = await organizationService.addUserToOrganization(organizationId, userId, role);

      if (!user) {
        throw notFound("User not found");
      }

      res.status(201).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/organizations/:organizationId/members/:userId
 * Remove a user from an organization (only ORGANIZATION_ADMIN)
 */
router.delete(
  "/:organizationId/members/:userId",
  verifyJWTToken,
  requireRole("ORGANIZATION_ADMIN"),
  requireOrganization,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;

      const removed = await organizationService.removeUserFromOrganization(userId);

      if (!removed) {
        throw notFound("User not found");
      }

      res.status(200).json({
        success: true,
        message: "User removed from organization",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
