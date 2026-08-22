import { z } from "zod";
import { ALLOWED_INVOICE_CATEGORIES } from "./categorization.types";

export const categorizationResponseSchema = z.object({
  category: z.string().min(1),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1)
});

export const allowedCategorySchema = z.enum(ALLOWED_INVOICE_CATEGORIES);
