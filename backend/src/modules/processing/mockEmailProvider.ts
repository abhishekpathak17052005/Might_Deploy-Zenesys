import { v4 as uuidv4 } from "uuid";
import type { EmailProvider, FinanceNotification } from "./invoiceProcessing.types";

export class MockEmailProvider implements EmailProvider {
  readonly outbox: FinanceNotification[] = [];

  async notifyFinanceManager(input: {
    invoiceId: string;
    riskLevel: string;
    riskScore: number;
    signalCount: number;
  }): Promise<FinanceNotification> {
    const notification: FinanceNotification = {
      id: uuidv4(),
      toRole: "FINANCE_MANAGER",
      subject: `Invoice ${input.invoiceId} requires finance review`,
      payload: input,
      queuedAt: new Date(),
      provider: "mock",
      status: "QUEUED"
    };

    this.outbox.push(notification);
    return notification;
  }
}

export const mockEmailProvider = new MockEmailProvider();
