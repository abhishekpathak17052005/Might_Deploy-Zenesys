import { z } from "zod";
import { USER_ROLES } from "../../types/user.types";

export const userSchema = z.object({
  uid: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(USER_ROLES),
  department: z.string(),
  isActive: z.boolean(),
  createdAt: z.unknown(),
  updatedAt: z.unknown()
});

export type UserDocument = z.infer<typeof userSchema>;
