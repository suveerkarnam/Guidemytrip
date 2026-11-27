import { OAuth2Client } from "google-auth-library";
import { config } from "../config.js";

export type VerifiedGoogleIdentity = { subject: string; email: string; name: string; picture?: string; emailVerified: true };

export async function verifyGoogleIdentity(idToken: string): Promise<VerifiedGoogleIdentity> {
  if (!config.GOOGLE_CLIENT_ID) throw new Error("GOOGLE_NOT_CONFIGURED");
  const client = new OAuth2Client(config.GOOGLE_CLIENT_ID, config.GOOGLE_CLIENT_SECRET, config.GOOGLE_REDIRECT_URI);
  const ticket = await client.verifyIdToken({ idToken, audience: config.GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email || payload.email_verified !== true) throw new Error("GOOGLE_IDENTITY_NOT_VERIFIED");
  return { subject: payload.sub, email: payload.email.toLowerCase(), name: payload.name ?? "GuideMyTrip traveller", picture: payload.picture, emailVerified: true };
}
