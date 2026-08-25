/**
 * Extraction Module Routes
 * Handles invoice document extraction and OCR
 */

import { Router } from "express";
import { ollamaGlmOcrProvider } from "./ollamaGlmOcrProvider";

const router = Router();

/**
 * GET /api/extraction/health
 * Check extraction provider health
 */
router.get("/health", async (req, res) => {
  try {
    const provider = process.env.EXTRACTION_PROVIDER || "gemini";
    
    if (provider === "ollama") {
      const health = await ollamaGlmOcrProvider.healthCheck();
      return res.status(health.healthy ? 200 : 503).json({
        success: health.healthy,
        data: {
          provider: "ollama",
          ...health
        }
      });
    }

    // Gemini health is simpler - just check API key
    const hasGeminiKey = !!process.env.GEMINI_API_KEY;
    return res.status(hasGeminiKey ? 200 : 503).json({
      success: hasGeminiKey,
      data: {
        provider: "gemini",
        healthy: hasGeminiKey,
        message: hasGeminiKey ? "Gemini API is configured" : "Gemini API key not configured"
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "EXTRACTION_HEALTH_ERROR",
        message: error instanceof Error ? error.message : "Unknown error"
      }
    });
  }
});

/**
 * POST /api/extraction/test
 * Test extraction provider with sample image/document
 */
router.post("/test", async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg" } = req.body;

    if (!imageBase64) {
      return res.status(400).json({
        success: false,
        error: {
          code: "MISSING_IMAGE",
          message: "imageBase64 is required"
        }
      });
    }

    const buffer = Buffer.from(imageBase64, "base64");
    const provider = process.env.EXTRACTION_PROVIDER || "gemini";

    let result;
    if (provider === "ollama") {
      result = await ollamaGlmOcrProvider.extractInvoice({
        documentBuffer: buffer,
        mimeType,
        filename: "test-document"
      });
    } else {
      // Gemini extraction would go here
      return res.status(501).json({
        success: false,
        error: {
          code: "NOT_IMPLEMENTED",
          message: "Gemini extraction test not implemented yet"
        }
      });
    }

    res.json({
      success: true,
      data: {
        provider,
        result,
        message: "Extraction test completed successfully"
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "EXTRACTION_TEST_ERROR",
        message: error instanceof Error ? error.message : "Unknown error"
      }
    });
  }
});

export default router;
