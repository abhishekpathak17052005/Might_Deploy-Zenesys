/**
 * Notification service for sending alerts to Finance Managers and Procurement Officers.
 */

import { emailProvider } from "./email.provider";

export interface NotificationContext {
  invoiceNumber: string;
  vendorName: string;
  amount: number;
  riskLevel: string;
  financeManagerEmail: string;
}

export class NotificationService {
  /**
   * Notify Finance Manager that an invoice requires review.
   */
  async notifyFinanceReviewRequired(context: NotificationContext): Promise<boolean> {
    const subject = `Invoice Review Required: ${context.invoiceNumber}`;
    const body = `
Invoice ${context.invoiceNumber} from ${context.vendorName} (₹${context.amount}) requires Finance Manager review.
Risk Level: ${context.riskLevel}

Please log in to the Invoice Verification system to review.
    `.trim();

    const result = await emailProvider.sendNotification({
      to: context.financeManagerEmail,
      subject,
      body,
      html: `
<h2>Invoice Review Required</h2>
<p>Invoice <strong>${context.invoiceNumber}</strong> from <strong>${context.vendorName}</strong> (₹${context.amount}) requires Finance Manager review.</p>
<p><strong>Risk Level:</strong> ${context.riskLevel}</p>
<p>Please log in to the Invoice Verification system to review.</p>
      `,
      type: "FINANCE_REVIEW_REQUIRED"
    });

    console.info("notification.sent", {
      type: "FINANCE_REVIEW_REQUIRED",
      invoiceNumber: context.invoiceNumber,
      to: context.financeManagerEmail,
      success: result.success
    });

    return result.success;
  }

  /**
   * Notify Procurement Officer that their invoice was approved.
   */
  async notifyInvoiceApproved(
    invoiceNumber: string,
    procurementOfficerEmail: string
  ): Promise<boolean> {
    const subject = `Invoice Approved: ${invoiceNumber}`;
    const body = `
Invoice ${invoiceNumber} has been approved and will be processed for payment.
    `.trim();

    const result = await emailProvider.sendNotification({
      to: procurementOfficerEmail,
      subject,
      body,
      html: `
<h2>Invoice Approved</h2>
<p>Invoice <strong>${invoiceNumber}</strong> has been approved and will be processed for payment.</p>
      `,
      type: "INVOICE_APPROVED"
    });

    console.info("notification.sent", {
      type: "INVOICE_APPROVED",
      invoiceNumber,
      to: procurementOfficerEmail,
      success: result.success
    });

    return result.success;
  }

  /**
   * Notify Procurement Officer that their invoice was rejected.
   */
  async notifyInvoiceRejected(
    invoiceNumber: string,
    reason: string,
    procurementOfficerEmail: string
  ): Promise<boolean> {
    const subject = `Invoice Rejected: ${invoiceNumber}`;
    const body = `
Invoice ${invoiceNumber} has been rejected.
Reason: ${reason}

Please resubmit with corrections if applicable.
    `.trim();

    const result = await emailProvider.sendNotification({
      to: procurementOfficerEmail,
      subject,
      body,
      html: `
<h2>Invoice Rejected</h2>
<p>Invoice <strong>${invoiceNumber}</strong> has been rejected.</p>
<p><strong>Reason:</strong> ${reason}</p>
<p>Please resubmit with corrections if applicable.</p>
      `,
      type: "INVOICE_REJECTED"
    });

    console.info("notification.sent", {
      type: "INVOICE_REJECTED",
      invoiceNumber,
      to: procurementOfficerEmail,
      success: result.success
    });

    return result.success;
  }
}

export const notificationService = new NotificationService();
