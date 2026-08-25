export const MONEY_TOLERANCE = Number(process.env.EXTRACTION_MONEY_TOLERANCE ?? "0.01");

export const GSTIN_FORMAT = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const EXTRACTION_MODEL = process.env.GEMINI_EXTRACTION_MODEL ?? "gemini-3.6-flash";

export const GEMINI_API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export const GROQ_DEFAULT_EXTRACTION_MODEL = process.env.GROQ_EXTRACTION_MODEL ?? "qwen/qwen3.6-27b";
