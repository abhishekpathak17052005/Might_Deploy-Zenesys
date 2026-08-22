/**
 * Email notification provider abstraction.
 * Allows swapping between mock, SMTP, SendGrid, etc.
 */

export interface EmailNotification {
  to: string;
  subject: string;
  body: string;
  html?: string;
  type: "FINANCE_REVIEW_REQUIRED" | "INVOICE_APPROVED" | "INVOICE_REJECTED";
}

export interface EmailProvider {
  sendNotification(notification: EmailNotification): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
}

/**
 * Mock email provider for development.
 * Records notifications to an in-memory outbox instead of sending.
 */
export class MockEmailProvider implements EmailProvider {
  private outbox: EmailNotification[] = [];

  async sendNotification(notification: EmailNotification): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      this.outbox.push(notification);

      console.info("email.mock.sent", {
        to: notification.to,
        type: notification.type,
        subject: notification.subject
      });

      return {
        success: true,
        messageId: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: message
      };
    }
  }

  /**
   * Get all notifications sent during this session (for testing).
   */
  getOutbox(): EmailNotification[] {
    return [...this.outbox];
  }

  /**
   * Clear the outbox (for testing).
   */
  clearOutbox(): void {
    this.outbox = [];
  }
}

/**
 * SMTP email provider for production.
 * Uses nodemailer or similar SMTP client.
 */
export class SMTPEmailProvider implements EmailProvider {
  private smtpConfig: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };

  constructor(config: {
    host: string;
    port: number;
    secure: boolean;
    auth: { user: string; pass: string };
  }) {
    this.smtpConfig = config;
  }

  async sendNotification(notification: EmailNotification): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      // TODO: Implement actual SMTP sending with nodemailer
      // const transporter = nodemailer.createTransport(this.smtpConfig);
      // const info = await transporter.sendMail({
      //   from: this.smtpConfig.auth.user,
      //   to: notification.to,
      //   subject: notification.subject,
      //   text: notification.body,
      //   html: notification.html
      // });

      console.info("email.smtp.placeholder", {
        to: notification.to,
        type: notification.type,
        subject: notification.subject,
        message: "SMTP sending not yet implemented - use MockEmailProvider for development"
      });

      return {
        success: false,
        error: "SMTP sending not yet implemented"
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: message
      };
    }
  }
}

// Default to mock for development
export const emailProvider: EmailProvider = new MockEmailProvider();
