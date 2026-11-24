import nodemailer from "nodemailer";
import { config } from "../config.js";

export type PasswordResetDelivery = { email: string; resetUrl: string; expiresInMinutes: number };

export interface EmailProvider {
  sendPasswordReset(delivery: PasswordResetDelivery): Promise<void>;
}

export class MockEmailProvider implements EmailProvider {
  private lastDelivery?: PasswordResetDelivery;

  async sendPasswordReset(delivery: PasswordResetDelivery) { this.lastDelivery = delivery; }
  getLastDeliveryForTests() { return this.lastDelivery; }
}

class SmtpEmailProvider implements EmailProvider {
  private readonly transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    auth: config.SMTP_USER && config.SMTP_PASSWORD ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } : undefined,
  });

  async sendPasswordReset(delivery: PasswordResetDelivery) {
    await this.transport.sendMail({
      from: config.SMTP_FROM_EMAIL,
      to: delivery.email,
      subject: "Reset your GuideMyTrip password",
      text: `Reset your GuideMyTrip password using this link: ${delivery.resetUrl}\n\nThis link expires in ${delivery.expiresInMinutes} minutes and can only be used once.`,
      html: `<p>We received a request to reset your GuideMyTrip password.</p><p><a href="${delivery.resetUrl}">Reset your password</a></p><p>This link expires in ${delivery.expiresInMinutes} minutes and can only be used once.</p>`,
    });
  }
}

export const mockEmailProvider = new MockEmailProvider();
export const emailProvider: EmailProvider = config.EMAIL_PROVIDER === "smtp" ? new SmtpEmailProvider() : mockEmailProvider;
