import "dotenv/config";
import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  JWT_ACCESS_SECRET: z.string().min(32).default("development-access-secret-change-me-32chars"),
  OTP_HASH_SECRET: z.string().min(32).default("development-otp-secret-change-me-32chars"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),
  AUTH_OTP_PROVIDER: z.enum(["mock", "sms"]).default("mock"),
  COOKIE_SECURE: z.string().transform((value) => value === "true").default("false"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
});

export const config = configSchema.parse(process.env);

if (config.NODE_ENV === "production" && (config.JWT_ACCESS_SECRET.startsWith("development-") || config.OTP_HASH_SECRET.startsWith("development-") || config.AUTH_OTP_PROVIDER === "mock")) {
  throw new Error("Production authentication requires non-default secrets and a real SMS provider");
}
