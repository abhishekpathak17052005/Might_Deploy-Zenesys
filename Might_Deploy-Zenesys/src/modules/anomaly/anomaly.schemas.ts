import { z } from "zod";

const dateLikeSchema = z.union([z.string(), z.date()]).nullable().optional();

export const anomalyLineItemSchema = z.object({
  id: z.string().optional(),
  sku: z.string().nullable().optional(),
  productCode: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  quantity: z.number().nullable().optional(),
  amount: z.number().nullable().optional()
});

export const anomalyInvoiceInputSchema = z.object({
  id: z.string().optional(),
  invoiceNumber: z.string().nullable().optional(),
  invoiceType: z.enum(["PO_BASED", "NON_PO"]).default("NON_PO"),
  vendorId: z.string().nullable().optional(),
  vendorName: z.string().nullable().optional(),
  poId: z.string().nullable().optional(),
  poNumber: z.string().nullable().optional(),
  totalAmount: z.number().nullable().optional(),
  subtotal: z.number().nullable().optional(),
  taxAmount: z.number().nullable().optional(),
  discountAmount: z.number().nullable().optional(),
  invoiceDate: dateLikeSchema,
  dueDate: dateLikeSchema,
  gstin: z.string().nullable().optional(),
  billingAddress: z.string().nullable().optional(),
  lineItems: z.array(anomalyLineItemSchema).default([])
});

export const anomalyVendorContextSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  gstin: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  legalName: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  bankDetailsVerified: z.boolean().optional(),
  bankDetailsUpdatedAt: dateLikeSchema,
  isApproved: z.boolean().optional(),
  approvedAt: dateLikeSchema,
  createdAt: dateLikeSchema
});

export const anomalyPurchaseOrderContextSchema = z.object({
  id: z.string().optional(),
  poNumber: z.string().optional(),
  vendorId: z.string().nullable().optional(),
  totalAmount: z.number().nullable().optional(),
  poDate: dateLikeSchema,
  createdAt: dateLikeSchema,
  lineItems: z.array(anomalyLineItemSchema).default([])
});

export const anomalyHistoricalInvoiceSchema = z.object({
  id: z.string().optional(),
  invoiceNumber: z.string().nullable().optional(),
  vendorId: z.string().nullable().optional(),
  vendorName: z.string().nullable().optional(),
  poId: z.string().nullable().optional(),
  poNumber: z.string().nullable().optional(),
  totalAmount: z.number().nullable().optional(),
  invoiceDate: dateLikeSchema,
  gstin: z.string().nullable().optional()
});

export const anomalyEvaluateRequestSchema = z.object({
  invoice: anomalyInvoiceInputSchema,
  vendor: anomalyVendorContextSchema.optional(),
  purchaseOrder: anomalyPurchaseOrderContextSchema.optional(),
  historicalInvoices: z.array(anomalyHistoricalInvoiceSchema).default([]),
  recentInvoices: z.array(anomalyHistoricalInvoiceSchema).default([]),
  currentDate: dateLikeSchema
});
