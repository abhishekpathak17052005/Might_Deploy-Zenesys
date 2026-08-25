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
  
  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL must be a valid MongoDB connection string").optional(),
  
  // JWT Authentication
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required").default("your-secret-key-change-in-production"),
  
  // CORS
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  
  // Firebase (Legacy - for backward compatibility)
  FIREBASE_PROJECT_ID: optionalString,
  FIREBASE_CLIENT_EMAIL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().email("FIREBASE_CLIENT_EMAIL must be a valid service account email").optional()
  ),
  FIREBASE_PRIVATE_KEY: optionalString,
  FIREBASE_STORAGE_BUCKET: optionalString,
  
  // Gemini AI
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_EXTRACTION_MODEL: z.string().default("gemini-1.5-flash"),
  GEMINI_CATEGORIZATION_MODEL: z.string().default("gemini-1.5-flash"),
  EXTRACTION_MONEY_TOLERANCE: z.coerce.number().nonnegative().default(0.01),
  
  // Groq AI
  GROQ_API_KEY: z.string().optional(),
  GROQ_EXTRACTION_MODEL: z.string().default("llama-3.2-11b-vision-preview"),
  
  // OCR Provider
  EXTRACTION_PROVIDER: z.enum(["gemini", "ollama", "groq"]).default("gemini"),
  OLLAMA_URL: z.string().url().optional(),
  OLLAMA_MODEL: z.string().optional(),
  OLLAMA_TIMEOUT: z.coerce.number().optional(),
}).superRefine((env, ctx) => {
  if (env.NODE_ENV !== "production") return;

  // Check if using MongoDB
  if (!env.DATABASE_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["DATABASE_URL"],
      message: "DATABASE_URL is required in production (for MongoDB)"
    });
  }

  if (!env.JWT_SECRET || env.JWT_SECRET === "your-secret-key-change-in-production") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["JWT_SECRET"],
      message: "JWT_SECRET must be set to a secure value in production"
    });
  }

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
        message: `${key} is required in production if using Firebase`
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
