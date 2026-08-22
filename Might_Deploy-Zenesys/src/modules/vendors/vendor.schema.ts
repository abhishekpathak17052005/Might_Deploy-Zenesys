import { z } from "zod";

export const vendorSchema = z.object({
  id: z.string(),
  name: z.string(),
  gstin: z.string(),
  email: z.string().email(),
  phone: z.string(),
  address: z.string(),
  isActive: z.boolean(),
  createdAt: z.unknown(),
  updatedAt: z.unknown()
});

export type VendorDocument = z.infer<typeof vendorSchema>;
