import bcrypt from "bcryptjs";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { config } from "../config.js";

const accessSecret = new TextEncoder().encode(config.JWT_ACCESS_SECRET);

export type AccessClaims = JWTPayload & { roles: string[]; tokenType: "access" };

export function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }

export function hashPassword(password: string) {
  return bcrypt.hashSync(password, 12);
}

export function verifyPassword(password: string, stored: string) {
  try { return bcrypt.compareSync(password, stored); } catch { return false; }
}

export async function createAccessToken(userId: string, roles: string[]) {
  return new SignJWT({ roles, tokenType: "access" satisfies AccessClaims["tokenType"] })
    .setProtectedHeader({ alg: "HS256" }).setSubject(userId).setIssuedAt()
    .setExpirationTime(`${config.ACCESS_TOKEN_TTL_SECONDS}s`).sign(accessSecret);
}

export async function verifyAccessToken(token: string) {
  const result = await jwtVerify<AccessClaims>(token, accessSecret, { algorithms: ["HS256"] });
  if (result.payload.tokenType !== "access" || !result.payload.sub || !Array.isArray(result.payload.roles)) throw new Error("Invalid access token");
  return result.payload;
}

export function createRefreshToken() { return randomBytes(48).toString("base64url"); }

export function safeEqual(left: string, right: string) {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
