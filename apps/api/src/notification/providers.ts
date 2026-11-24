import { randomBytes } from "node:crypto";

export type EmailMessage = { to: string; subject: string; body: string };
export interface EmailProvider { send(message: EmailMessage): Promise<{ providerMessageId: string }>; }
export type MobileMessage = { to: string; body: string };
export interface SmsProvider { send(message: MobileMessage): Promise<{ providerMessageId: string }>; }
export interface WhatsAppProvider { send(message: MobileMessage): Promise<{ providerMessageId: string }>; }

export class MockEmailProvider implements EmailProvider {
  async send(message: EmailMessage) { void message; return { providerMessageId: `mock-email-${randomBytes(8).toString("hex")}` }; }
}

export const emailProvider: EmailProvider = new MockEmailProvider();
export const smsNotificationProvider: SmsProvider = { async send(message) { void message; return { providerMessageId: `mock-sms-${randomBytes(8).toString("hex")}` }; } };
export const whatsAppProvider: WhatsAppProvider = { async send(message) { void message; return { providerMessageId: `mock-whatsapp-${randomBytes(8).toString("hex")}` }; } };
