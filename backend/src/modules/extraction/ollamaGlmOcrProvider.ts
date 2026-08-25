/**
 * Ollama GLM-OCR Provider
 * Uses Ollama with GLM vision model for local OCR and invoice extraction
 * No API keys needed - runs locally on your machine
 * 
 * Installation:
 * 1. Install Ollama from https://ollama.ai
 * 2. Pull GLM model: ollama pull glm
 * 3. Run: ollama serve
 * 4. Set OLLAMA_URL in .env
 */

import fs from "fs/promises";
import type { InvoiceExtractionProvider } from "./extraction.types";

interface OllamaGlmResponse {
  text: string;
  model: string;
}

export class OllamaGlmOcrProvider implements InvoiceExtractionProvider {
  private readonly ollamaUrl: string;
  private readonly model: string = "glm";
  private readonly timeout: number = 60000; // 60 seconds

  constructor(ollamaUrl?: string) {
    this.ollamaUrl = ollamaUrl || process.env.OLLAMA_URL || "http://localhost:11434";
  }

  async extractInvoice(input: {
    documentBuffer: Buffer;
    mimeType: string;
    filename: string;
  }): Promise<unknown> {
    try {
      // Convert buffer to base64
      const base64Image = input.documentBuffer.toString("base64");

      // Determine media type
      const mediaType = this.getMediaType(input.mimeType);

      // Create the extraction prompt
      const prompt = this.createExtractionPrompt();

      // Call Ollama GLM API
      const response = await this.callOllamaGlm(base64Image, mediaType, prompt);

      // Parse the response
      return this.parseResponse(response);
    } catch (error) {
      console.error("Ollama GLM-OCR extraction error:", error);
      throw new Error(`Failed to extract invoice with Ollama GLM-OCR: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private getMediaType(mimeType: string): string {
    const mediaTypeMap: Record<string, string> = {
      "image/jpeg": "image/jpeg",
      "image/jpg": "image/jpeg",
      "image/png": "image/png",
      "image/webp": "image/webp",
      "application/pdf": "application/pdf"
    };
    return mediaTypeMap[mimeType] || "image/jpeg";
  }

  private createExtractionPrompt(): string {
    return `You are an expert invoice OCR assistant. Extract the following information from the invoice image and return it as JSON.

IMPORTANT: Return ONLY valid JSON, no markdown, no explanations.

Extract these fields:
{
  "invoice_number": "string - invoice/bill number",
  "invoice_date": "YYYY-MM-DD format",
  "vendor_name": "string - company/vendor name",
  "gstin": "string - 15-digit GST number or null",
  "po_number": "string - purchase order number or null",
  "subtotal": "number - amount before tax",
  "tax": "number - tax amount",
  "total": "number - total amount",
  "due_date": "YYYY-MM-DD format or null",
  "items": [
    {
      "description": "string - item description",
      "quantity": "number",
      "unit_price": "number",
      "tax_rate": "number or null - tax percentage",
      "amount": "number - line total"
    }
  ]
}

Return ONLY the JSON object, nothing else.`;
  }

  private async callOllamaGlm(
    base64Image: string,
    mediaType: string,
    prompt: string
  ): Promise<string> {
    const url = `${this.ollamaUrl}/api/generate`;

    const payload = {
      model: this.model,
      prompt: `${prompt}\n\nImage (${mediaType}): data:${mediaType};base64,${base64Image}`,
      stream: false,
      temperature: 0.3 // Low temperature for consistent extraction
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${error}`);
      }

      const data = (await response.json()) as OllamaGlmResponse;
      return data.text;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Ollama GLM-OCR request timeout - ensure Ollama is running and accessible");
      }
      throw error;
    }
  }

  private parseResponse(responseText: string): unknown {
    try {
      // Try to find JSON in the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in Ollama response");
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error("Failed to parse Ollama response:", responseText);
      throw new Error(`Invalid JSON in Ollama GLM-OCR response: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Health check - verify Ollama is running and GLM model is available
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/tags`, {
        method: "GET",
        timeout: 5000
      });

      if (!response.ok) {
        return {
          healthy: false,
          message: `Ollama API error: ${response.status}`
        };
      }

      const data = (await response.json()) as { models?: Array<{ name: string }> };
      const hasGlm = data.models?.some(m => m.name.includes("glm"));

      if (!hasGlm) {
        return {
          healthy: false,
          message: "GLM model not found. Run: ollama pull glm"
        };
      }

      return {
        healthy: true,
        message: "Ollama GLM-OCR is ready"
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Ollama connection failed: ${error instanceof Error ? error.message : String(error)}. Is Ollama running?`
      };
    }
  }
}

export const ollamaGlmOcrProvider = new OllamaGlmOcrProvider();
