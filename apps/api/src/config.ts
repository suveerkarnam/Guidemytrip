import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// Load the repository-level environment first so workspace commands do not
// accidentally fall back to apps/api/.env with a different payment provider.
// Existing process environment variables remain authoritative because dotenv
// does not override them by default.
dotenv.config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)), override: false });

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  JWT_ACCESS_SECRET: z.string().min(32).default("development-access-secret-change-me-32chars"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  COOKIE_SECURE: z.string().transform((value) => value === "true").default("false"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  PAYMENT_PROVIDER: z.enum(["mock", "razorpay"]).default("mock"),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  EMAIL_PROVIDER: z.enum(["mock", "smtp"]).default("mock"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM_EMAIL: z.string().email().default("no-reply@guidemytrip.local"),
  PASSWORD_RESET_TOKEN_EXPIRY_MINUTES: z.coerce.number().int().positive().default(30),
});

export const config = configSchema.parse(process.env);

if (config.NODE_ENV === "production" && config.JWT_ACCESS_SECRET.startsWith("development-")) {
  throw new Error("Production authentication requires a non-default access-token secret");
}

if (config.NODE_ENV === "production" && (config.PAYMENT_PROVIDER !== "razorpay" || !config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET || !config.RAZORPAY_WEBHOOK_SECRET)) {
  throw new Error("Production payments require Razorpay credentials and webhook validation configuration");
}
