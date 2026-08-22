import { z } from "zod";

export const purchaseOrderSchema = z.object({
  id: z.string(),
  poNumber: z.string(),
  vendorId: z.string(),
  totalAmount: z.number(),
  currency: z.string().default("INR"),
  status: z.enum(["OPEN", "CLOSED", "CANCELLED"]),
  lineItems: z.array(z.unknown()),
  createdAt: z.unknown(),
  updatedAt: z.unknown()
});

export type PurchaseOrderDocument = z.infer<typeof purchaseOrderSchema>;
