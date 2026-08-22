import { z } from "zod";

export const auditLogSchema = z.object({
  id: z.string(),
  userId: z.string(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  details: z.record(z.unknown()),
  timestamp: z.unknown()
});

export type AuditLogDocument = z.infer<typeof auditLogSchema>;
