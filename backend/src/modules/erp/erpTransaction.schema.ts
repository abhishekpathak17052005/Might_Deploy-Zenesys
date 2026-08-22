import { z } from "zod";

export const erpTransactionSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  vendorId: z.string(),
  invoiceNumber: z.string(),
  amount: z.number(),
  taxAmount: z.number(),
  category: z.string(),
  costCenter: z.string(),
  status: z.enum(["PENDING", "POSTED", "FAILED"]),
  createdAt: z.unknown()
});

export type ErpTransactionDocument = z.infer<typeof erpTransactionSchema>;
