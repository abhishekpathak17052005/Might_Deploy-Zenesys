import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional()
);

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  FIREBASE_PROJECT_ID: optionalString,
  FIREBASE_CLIENT_EMAIL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().email("FIREBASE_CLIENT_EMAIL must be a valid service account email").optional()
  ),
  FIREBASE_PRIVATE_KEY: optionalString,
  FIREBASE_STORAGE_BUCKET: optionalString,
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_EXTRACTION_MODEL: z.string().default("gemini-1.5-flash"),
  GEMINI_CATEGORIZATION_MODEL: z.string().default("gemini-1.5-flash"),
  EXTRACTION_MONEY_TOLERANCE: z.coerce.number().nonnegative().default(0.01)
}).superRefine((env, ctx) => {
  if (env.NODE_ENV !== "production") return;

  const requiredFirebaseVars = [
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
    "FIREBASE_STORAGE_BUCKET"
  ] as const;

  for (const key of requiredFirebaseVars) {
    if (!env[key]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} is required in production`
      });
    }
  }
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const messages = parsedEnv.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  throw new Error(`Invalid environment configuration: ${messages.join("; ")}`);
}

export const env = parsedEnv.data;

export const isProduction = env.NODE_ENV === "production";
export const isFirebaseConfigured = Boolean(
  env.FIREBASE_PROJECT_ID &&
    env.FIREBASE_CLIENT_EMAIL &&
    env.FIREBASE_PRIVATE_KEY &&
    env.FIREBASE_STORAGE_BUCKET
);
