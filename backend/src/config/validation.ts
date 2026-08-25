/**
 * Environment variable validation
 * Ensures all required configs are present at startup
 */

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "staging"]).optional().default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).optional().default(5000),
  CORS_ORIGIN: z.string().min(1),

  // Firebase
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().email(),
  FIREBASE_PRIVATE_KEY: z.string().min(1),
  FIREBASE_STORAGE_BUCKET: z.string().min(1),

  // Gemini
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_EXTRACTION_MODEL: z.string().optional().default("gemini-pro-vision"),
  GEMINI_CATEGORIZATION_MODEL: z.string().optional().default("gemini-pro"),

  // Groq
  GROQ_API_KEY: z.string().optional(),
  GROQ_EXTRACTION_MODEL: z.string().optional().default("llama-3.2-11b-vision-preview"),

  // OCR
  EXTRACTION_PROVIDER: z.enum(["gemini", "ollama", "groq"]).optional().default("gemini"),
  OLLAMA_URL: z.string().url().optional().default("http://localhost:11434"),
  OLLAMA_MODEL: z.string().optional().default("glm"),
  OLLAMA_TIMEOUT: z.coerce.number().optional().default(60000)
});

export type EnvironmentConfig = z.infer<typeof envSchema>;

export function validateEnvironment(): EnvironmentConfig {
  try {
    const config = envSchema.parse(process.env);
    console.log("✅ Environment variables validated successfully");
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Environment validation failed:");
      error.errors.forEach((err) => {
        console.error(`   ${err.path.join(".")}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Check for required API keys at startup
 */
export function validateAPIKeys() {
  const required = ["FIREBASE_PROJECT_ID", "GEMINI_API_KEY"];
  const missing: string[] = [];

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:", missing.join(", "));
    console.error("Please check your .env file");
    process.exit(1);
  }

  console.log("✅ All required API keys configured");
}
