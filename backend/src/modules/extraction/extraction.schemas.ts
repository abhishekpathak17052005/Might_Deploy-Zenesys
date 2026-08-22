import { z } from "zod";
import { GSTIN_FORMAT } from "./extraction.constants";

const confidenceSchema = z.number().min(0).max(1).optional();

const stringFieldSchema = z.union([
  z.string(),
  z.object({
    value: z.string().nullable(),
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
  z.number(),
  z.object({
    value: z.number().nullable(),
    confidence: confidenceSchema
  })
]);

const dateString = z.string().refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(date.getTime());
}, "Date must be a valid YYYY-MM-DD value");

export const geminiInvoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().finite().nonnegative(),
  unit_price: z.number().finite().nonnegative(),
  tax_rate: z.number().finite().nonnegative().optional().nullable(),
  amount: z.number().finite().nonnegative()
});

export const geminiExtractionResponseSchema = z.object({
  invoice_number: stringFieldSchema,
  invoice_date: stringFieldSchema.pipe(z.union([
    dateString,
    z.object({ value: dateString.nullable(), confidence: confidenceSchema })
  ])),
  vendor_name: stringFieldSchema,
  gstin: optionalStringFieldSchema.optional().nullable(),
  po_number: optionalStringFieldSchema.optional().nullable(),
  subtotal: numberFieldSchema,
  tax: numberFieldSchema,
  total: numberFieldSchema,
  due_date: optionalStringFieldSchema.optional().nullable(),
  items: z.array(geminiInvoiceItemSchema).min(1)
});

export const structuredInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1),
  invoiceDate: z.date(),
  vendorName: z.string().min(1),
  gstin: z.string().regex(GSTIN_FORMAT).nullable().optional(),
  poNumber: z.string().nullable().optional(),
  subtotal: z.number().finite().nonnegative(),
  tax: z.number().finite().nonnegative(),
  total: z.number().finite().nonnegative(),
  dueDate: z.date().nullable().optional(),
  items: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().finite().nonnegative(),
    unitPrice: z.number().finite().nonnegative(),
    taxRate: z.number().finite().nonnegative().nullable().optional(),
    amount: z.number().finite().nonnegative()
  })).min(1)
});
