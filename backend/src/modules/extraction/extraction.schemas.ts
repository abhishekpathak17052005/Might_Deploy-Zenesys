import { z } from "zod";
import { GSTIN_FORMAT } from "./extraction.constants";

const confidenceSchema = z.number().min(0).max(1).optional();

const stringFieldSchema = z.union([
  z.string().min(1),
  z.null(),
  z.object({
    value: z.string().min(1).nullable(),
    confidence: confidenceSchema
  })
]);

const optionalStringFieldSchema = z.union([
  z.string().nullable(),
  z.object({
    value: z.string().nullable(),
    confidence: confidenceSchema
  })
]);

const numberFieldSchema = z.union([
  z.number().finite(),
  z.null(),
  z.object({
    value: z.number().finite().nullable(),
    confidence: confidenceSchema
  })
]);

const dateString = z.string().refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(date.getTime());
}, "Date must be a valid YYYY-MM-DD value");

export const geminiInvoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().finite().nonnegative().nullable(),
  unit_price: z.number().finite().nonnegative().nullable(),
  tax_rate: z.number().finite().nonnegative().optional().nullable(),
  amount: z.number().finite().nonnegative().nullable()
});

const dateFieldSchema = z.union([
  dateString,
  z.null(),
  z.object({ value: dateString.nullable(), confidence: confidenceSchema }),
]);

export const geminiExtractionResponseSchema = z.object({
  invoice_number: stringFieldSchema,
  invoice_date: dateFieldSchema,
  vendor_name: stringFieldSchema,
  gstin: optionalStringFieldSchema.optional().nullable(),
  po_number: optionalStringFieldSchema.optional().nullable(),
  subtotal: numberFieldSchema,
  tax: numberFieldSchema,
  total: numberFieldSchema,
  currency: optionalStringFieldSchema.optional().nullable(),
  discount: numberFieldSchema.optional().nullable(),
  shipping: numberFieldSchema.optional().nullable(),
  adjustments: numberFieldSchema.optional().nullable(),
  due_date: optionalStringFieldSchema.optional().nullable(),
  items: z.array(geminiInvoiceItemSchema)
});

export const structuredInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1),
  invoiceDate: z.date(),
  vendorName: z.string().min(1),
  gstin: z.string().regex(GSTIN_FORMAT).nullable().optional(),
  poNumber: z.string().nullable().optional(),
  subtotal: z.number().finite().nonnegative().nullable().optional(),
  tax: z.number().finite().nonnegative().nullable().optional(),
  total: z.number().finite().nonnegative().nullable().optional(),
  currency: z.string().nullable().optional(),
  discount: z.number().finite().nonnegative().nullable().optional(),
  shipping: z.number().finite().nonnegative().nullable().optional(),
  adjustments: z.number().finite().nullable().optional(),
  dueDate: z.date().nullable().optional(),
  items: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().finite().nonnegative().nullable(),
    unitPrice: z.number().finite().nonnegative().nullable(),
    taxRate: z.number().finite().nonnegative().nullable().optional(),
    amount: z.number().finite().nonnegative().nullable()
  })).min(1)
});
