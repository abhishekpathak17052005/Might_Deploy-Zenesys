import { FieldValue } from "firebase-admin/firestore";
import { COLLECTIONS } from "../../config/constants";
import { firestore } from "../../config/firebase";

export interface CreateAuditLogInput {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
  timestamp: Date;
}

class AuditService {
  async createAuditLog(input: CreateAuditLogInput): Promise<string> {
    const ref = firestore.collection(COLLECTIONS.auditLogs).doc();
    const auditLog = {
      id: ref.id,
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      details: input.details ?? {},
      timestamp: FieldValue.serverTimestamp()
    };

    await ref.set(auditLog);
    console.info("audit.log.created", {
      auditLogId: ref.id,
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId
    });
    return ref.id;
  }

  async getAuditLogById(id: string): Promise<AuditLog | null> {
    const snapshot = await firestore.collection(COLLECTIONS.auditLogs).doc(id).get();

    if (!snapshot.exists) {
      return null;
    }

    return snapshot.data() as AuditLog;
  }

  async getAuditLogsForEntity(entityType: string, entityId: string, limit: number = 20): Promise<AuditLog[]> {
    const snapshot = await firestore
      .collection(COLLECTIONS.auditLogs)
      .where("entityType", "==", entityType)
      .where("entityId", "==", entityId)
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => doc.data() as AuditLog);
  }

  async getAuditLogsForUser(userId: string, limit: number = 20): Promise<AuditLog[]> {
    const snapshot = await firestore
      .collection(COLLECTIONS.auditLogs)
      .where("userId", "==", userId)
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => doc.data() as AuditLog);
  }
}

export const auditService = new AuditService();

// Legacy exports for backward compatibility
export async function createAuditLog(input: CreateAuditLogInput) {
  return auditService.createAuditLog(input);
}

export async function getAuditLogById(id: string) {
  return auditService.getAuditLogById(id);
}
