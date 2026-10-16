import { z } from "zod";
import { createHash } from "node:crypto";
import { EXTRACTION_MODEL } from "./extraction.constants";
import { geminiExtractionResponseSchema } from "./extraction.schemas";
import { validateExtractedInvoiceMath } from "./extraction.validator";
import { geminiExtractionProvider } from "./geminiExtractionProvider";
import { ollamaGlmOcrProvider } from "./ollamaGlmOcrProvider";
import { groqExtractionProvider } from "./groqExtractionProvider";
import { ocrSpaceInvoiceProvider } from "./ocrSpaceInvoiceProvider";
import type {
  ExtractionConfidence,
  ExtractionResult,
  FieldExtraction,
  FieldExtractionStatus,
  InvoiceExtractionProvider,
  StructuredInvoiceData
} from "./extraction.types";

type Wrapped<T> = T | { value: T | null; confidence?: number } | null | undefined;

function unwrap<T>(field: Wrapped<T>): { value: T | null; confidence?: number } {
  if (field && typeof field === "object" && "value" in field) {
    return { value: field.value, confidence: field.confidence };
  }

  return { value: field ?? null };
}

function fieldStatus(value: unknown, confidence?: number): FieldExtractionStatus {
  if (value === null || value === undefined || value === "") {
    return "MISSING";
  }

  return confidence === undefined || confidence < 0.75 ? "UNCERTAIN" : "EXTRACTED";
}

function field<T>(input: Wrapped<T>): FieldExtraction<T> {
  const unwrapped = unwrap(input);
  return {
    value: unwrapped.value,
    confidence: unwrapped.confidence,
    status: fieldStatus(unwrapped.value, unwrapped.confidence)
  };
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

export class ExtractionService {
  constructor(private readonly provider: InvoiceExtractionProvider = ExtractionService.getProvider()) {}

  private static getProvider(): InvoiceExtractionProvider {
    const providerType = process.env.EXTRACTION_PROVIDER || "ocr_space";

    if (providerType === "ocr_space") return ocrSpaceInvoiceProvider;
    
    if (providerType === "ollama") {
      return ollamaGlmOcrProvider;
    }
    
    if (providerType === "groq") {
      return groqExtractionProvider;
    }
    
    return geminiExtractionProvider;
  }

  async extract(input: {
    documentBuffer: Buffer;
    mimeType: string;
    filename: string;
    sourceDocumentId?: string;
    sourceDocumentVersion?: number;
  }): Promise<ExtractionResult> {
    const raw = await this.provider.extractInvoice(input);
    return {
      ...this.normalize(raw),
      sourceDocumentId: input.sourceDocumentId,
      sourceDocumentVersion: input.sourceDocumentVersion,
      sourceDocumentSha256: createHash("sha256").update(input.documentBuffer).digest("hex"),
    };
  }

  normalize(raw: unknown): ExtractionResult {
    const providerType = process.env.EXTRACTION_PROVIDER || "ocr_space";
    const parsed = geminiExtractionResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new z.ZodError(parsed.error.issues);
    }

    const data = parsed.data;
    const invoiceNumber = field<string>(data.invoice_number);
    const invoiceDate = field<string>(data.invoice_date);
    const vendorName = field<string>(data.vendor_name);
    const gstin = field<string>(data.gstin);
    const poNumber = field<string>(data.po_number);
    const subtotal = field<number>(data.subtotal);
    const tax = field<number>(data.tax);
    const total = field<number>(data.total);
    const dueDate = field<string>(data.due_date);

    const invoice: StructuredInvoiceData = {
      invoiceNumber: invoiceNumber.value ?? "",
      invoiceDate: parseDate(invoiceDate.value) ?? new Date("Invalid Date"),
      vendorName: vendorName.value ?? "",
      gstin: gstin.value || null,
      poNumber: poNumber.value || null,
      subtotal: subtotal.value ?? 0,
      tax: tax.value ?? 0,
      total: total.value ?? 0,
      dueDate: parseDate(dueDate.value),
      items: data.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        taxRate: item.tax_rate ?? null,
        amount: item.amount
      }))
    };

    const confidence: ExtractionConfidence = {
      invoiceNumber,
      invoiceDate,
      vendorName,
      gstin,
      poNumber,
      subtotal,
      tax,
      total,
      dueDate
    };

    const validation = validateExtractedInvoiceMath(invoice);

    const structuringProvider = typeof (raw as any)?.structuringProvider === "string" ? (raw as any).structuringProvider : undefined;
    const provider = providerType === "ocr_space" && structuringProvider
      ? `ocr_space+${structuringProvider}`
      : providerType;
    return {
      raw,
      invoice,
      confidence,
      validation,
      provider,
      model: typeof (raw as any)?.structuringModel === "string"
        ? (raw as any).structuringModel
        : providerType === "ocr_space" ? "OCR.space Engine 2" : EXTRACTION_MODEL,
      extractedAt: new Date()
    };
  }
}

export const extractionService = new ExtractionService();
