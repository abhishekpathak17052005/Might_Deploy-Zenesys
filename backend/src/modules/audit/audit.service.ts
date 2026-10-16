/**
 * Audit Service - MongoDB implementation
 */
import { AuditLog as AuditLogModel, IAuditLog } from "../../models/AuditLog";
import { Types } from "mongoose";
import { v4 as uuidv4 } from "uuid";

export interface CreateAuditLogInput {
  userId: string;
  organizationId?: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
}

class AuditService {
  async createAuditLog(input: CreateAuditLogInput): Promise<string> {
    const doc = await AuditLogModel.create({
      actorId: new Types.ObjectId(input.userId),
      organizationId: input.organizationId ? new Types.ObjectId(input.organizationId) : new Types.ObjectId(),
      action: input.action,
      resourceType: input.entityType,
      resourceId: input.entityId,
      newState: input.details ?? {},
      timestamp: new Date(),
    });

    console.info("audit.log.created", {
      auditLogId: doc._id.toString(),
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId
    });

    return doc._id.toString();
  }

  async getAuditLogsForEntity(entityType: string, entityId: string, limit: number = 20): Promise<IAuditLog[]> {
    return await AuditLogModel.find({ resourceType: entityType, resourceId: entityId })
      .sort({ timestamp: -1 })
      .limit(limit);
  }

  async getAuditLogsForUser(userId: string, limit: number = 20): Promise<IAuditLog[]> {
    return await AuditLogModel.find({ actorId: new Types.ObjectId(userId) })
      .sort({ timestamp: -1 })
      .limit(limit);
  }

  async getAuditLogById(id: string): Promise<IAuditLog | null> {
    return await AuditLogModel.findById(id);
  }
}

export const auditService = new AuditService();

export async function createAuditLog(input: CreateAuditLogInput) {
  return auditService.createAuditLog(input);
}
