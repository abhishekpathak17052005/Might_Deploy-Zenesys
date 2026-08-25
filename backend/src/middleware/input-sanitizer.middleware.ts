import { Request, Response, NextFunction } from "express";

/**
 * Input sanitization middleware
 * Prevents XSS and injection attacks
 */

export function inputSanitizerMiddleware(req: Request, res: Response, next: NextFunction) {
  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  // Sanitize body
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body);
  }

  next();
}

function sanitizeObject(obj: any): any {
  if (typeof obj !== "object" || obj === null) {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const sanitized: any = {};
  for (const key in obj) {
    sanitized[key] = sanitizeObject(obj[key]);
  }
  return sanitized;
}

function sanitizeString(str: any): any {
  if (typeof str !== "string") {
    return str;
  }

  // Remove potentially dangerous characters
  return str
    .replace(/[<>]/g, "") // Remove angle brackets
    .replace(/javascript:/gi, "") // Remove javascript:
    .trim();
}

/**
 * Validate file uploads
 */
export function validateFileUpload(
  maxSizeMB: number = 10,
  allowedMimeTypes: string[] = ["application/pdf", "image/jpeg", "image/png"]
) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
      return next();
    }

    const maxBytes = maxSizeMB * 1024 * 1024;

    if (req.file.size > maxBytes) {
      return res.status(400).json({
        success: false,
        error: {
          code: "FILE_TOO_LARGE",
          message: `File size exceeds ${maxSizeMB}MB limit`
        }
      });
    }

    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_FILE_TYPE",
          message: `File type not allowed. Allowed: ${allowedMimeTypes.join(", ")}`
        }
      });
    }

    next();
  };
}
