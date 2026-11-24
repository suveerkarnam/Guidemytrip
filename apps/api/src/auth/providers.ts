import { OAuth2Client } from "google-auth-library";
import { config } from "../config.js";

export interface SmsProvider { sendOtp(phone: string, code: string, expiresInSeconds: number): Promise<void>; }

export class MockSmsProvider implements SmsProvider {
  readonly providerName = "mock";
  private lastDelivery?: { phone: string; code: string; expiresInSeconds: number };
  async sendOtp(phone: string, code: string, expiresInSeconds: number) { this.lastDelivery = { phone, code, expiresInSeconds }; }
  getLastDeliveryForTests() { return this.lastDelivery; }
}

class ConfiguredSmsProvider implements SmsProvider {
  async sendOtp(phone: string, code: string, expiresInSeconds: number) {
    void phone; void code; void expiresInSeconds;
    throw new Error("SMS_PROVIDER_NOT_CONFIGURED");
  }
}

export const mockSmsProvider = new MockSmsProvider();
export const smsProvider: SmsProvider = config.AUTH_OTP_PROVIDER === "mock" ? mockSmsProvider : new ConfiguredSmsProvider();

export type VerifiedGoogleIdentity = { subject: string; email: string; name: string; picture?: string; emailVerified: true };

export async function verifyGoogleIdentity(idToken: string): Promise<VerifiedGoogleIdentity> {
  if (!config.GOOGLE_CLIENT_ID) throw new Error("GOOGLE_NOT_CONFIGURED");
  const client = new OAuth2Client(config.GOOGLE_CLIENT_ID, config.GOOGLE_CLIENT_SECRET, config.GOOGLE_REDIRECT_URI);
  const ticket = await client.verifyIdToken({ idToken, audience: config.GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email || payload.email_verified !== true) throw new Error("GOOGLE_IDENTITY_NOT_VERIFIED");
  return { subject: payload.sub, email: payload.email.toLowerCase(), name: payload.name ?? "GuideMyTrip traveller", picture: payload.picture, emailVerified: true };
}
