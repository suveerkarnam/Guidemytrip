import { AuthProviderType, Prisma, PrismaClient, RoleCode } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { config } from "../config.js";
import { prisma as defaultPrisma } from "../db.js";
import { emailProvider } from "./email.js";
import { createAccessToken, createRefreshToken, hashPassword, hashToken, verifyPassword } from "./crypto.js";
import type { VerifiedGoogleIdentity } from "./providers.js";
import type { AuthUser } from "./types.js";

export class AuthError extends Error { constructor(public readonly code: string, public readonly status = 400) { super(code); } }

export function normalizePhone(phone: string) {
  const normalized = phone.replace(/[\s()-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) throw new AuthError("INVALID_PHONE", 422);
  return normalized;
}

export function normalizeEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new AuthError("INVALID_EMAIL", 422);
  return normalized;
}

function normalizeIdentifier(identifier: string) {
  const value = identifier.trim();
  return value.includes("@") ? { email: normalizeEmail(value), phone: undefined } : { email: undefined, phone: normalizePhone(value) };
}

export type SessionTokens = { accessToken: string; refreshToken: string; user: AuthUser };
export type SignupInput = { displayName: string; phone: string; email?: string; password: string };

export class AuthService {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async signup(input: SignupInput): Promise<SessionTokens> {
    const displayName = input.displayName.trim();
    if (!displayName) throw new AuthError("INVALID_DISPLAY_NAME", 422);
    const phone = normalizePhone(input.phone);
    const email = input.email?.trim() ? normalizeEmail(input.email) : undefined;
    validatePassword(input.password);
    try {
      const user = await this.db.user.create({ data: { displayName, phone, email, passwordHash: hashPassword(input.password), roles: { create: { role: { connect: { code: RoleCode.TOURIST } } } } }, include: { roles: { include: { role: true } } } });
      return this.issueSession(toAuthUser(user));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AuthError("ACCOUNT_ALREADY_EXISTS", 409);
      throw error;
    }
  }

  async login(identifierInput: string, password: string): Promise<SessionTokens> {
    const identifier = normalizeIdentifier(identifierInput);
    const user = await this.db.user.findFirst({ where: identifier.email ? { email: identifier.email } : { phone: identifier.phone }, include: { roles: { include: { role: true } } } });
    if (!user?.passwordHash || !verifyPassword(password, user.passwordHash) || !user.isActive || user.deletedAt) throw new AuthError("INVALID_CREDENTIALS", 401);
    return this.issueSession(toAuthUser(user));
  }

  async loginWithGoogle(identity: VerifiedGoogleIdentity, currentUserId?: string): Promise<SessionTokens> {
    const provider = await this.db.userAuthProvider.findUnique({ where: { provider_providerAccountId: { provider: AuthProviderType.GOOGLE, providerAccountId: identity.subject } }, include: { user: { include: { roles: { include: { role: true } } } } } });
    if (provider) { if (currentUserId && provider.userId !== currentUserId) throw new AuthError("GOOGLE_ACCOUNT_BELONGS_TO_ANOTHER_USER", 409); return this.issueSession(toAuthUser(provider.user)); }
    if (currentUserId) {
      const user = await this.db.user.findUnique({ where: { id: currentUserId }, include: { roles: { include: { role: true } } } });
      if (!user) throw new AuthError("USER_NOT_FOUND", 404);
      await this.db.userAuthProvider.create({ data: { userId: user.id, provider: AuthProviderType.GOOGLE, providerAccountId: identity.subject, email: identity.email } });
      await this.db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: user.emailVerifiedAt ?? new Date(), profileImageUrl: user.profileImageUrl ?? identity.picture } });
      return this.issueSession(toAuthUser(user));
    }
    const emailMatch = await this.db.user.findUnique({ where: { email: identity.email } });
    if (emailMatch) throw new AuthError("GOOGLE_ACCOUNT_LINK_REQUIRED", 409);
    const user = await this.db.user.create({ data: { email: identity.email, displayName: identity.name, profileImageUrl: identity.picture, emailVerifiedAt: new Date(), authProviders: { create: { provider: AuthProviderType.GOOGLE, providerAccountId: identity.subject, email: identity.email } }, roles: { create: { role: { connect: { code: RoleCode.TOURIST } } } } }, include: { roles: { include: { role: true } } } });
    return this.issueSession(toAuthUser(user));
  }

  async requestPasswordReset(emailInput: string) {
    const email = normalizeEmail(emailInput);
    const user = await this.db.user.findUnique({ where: { email } });
    if (user?.isActive && !user.deletedAt) {
      const rawToken = randomBytes(32).toString("base64url");
      await this.db.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
      await this.db.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + config.PASSWORD_RESET_TOKEN_EXPIRY_MINUTES * 60_000) } });
      try {
        await emailProvider.sendPasswordReset({ email, resetUrl: `${config.FRONTEND_URL}/reset-password?token=${encodeURIComponent(rawToken)}`, expiresInMinutes: config.PASSWORD_RESET_TOKEN_EXPIRY_MINUTES });
      } catch (error) {
        console.error("Password reset email delivery failed", { error: error instanceof Error ? error.message : "unknown" });
      }
    }
    return { message: "If an account exists with the provided email address, you will receive instructions to reset your password." };
  }

  async resetPassword(rawToken: string, password: string) {
    if (!rawToken || rawToken.length < 20) throw new AuthError("RESET_TOKEN_INVALID", 400);
    validatePassword(password);
    const token = await this.db.passwordResetToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
    if (!token || token.usedAt || token.expiresAt <= new Date()) throw new AuthError("RESET_TOKEN_INVALID", 400);
    await this.db.$transaction(async (transaction) => {
      const consumed = await transaction.passwordResetToken.updateMany({ where: { id: token.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
      if (consumed.count !== 1) throw new AuthError("RESET_TOKEN_INVALID", 400);
      await transaction.user.update({ where: { id: token.userId }, data: { passwordHash: hashPassword(password) } });
      await transaction.session.updateMany({ where: { userId: token.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    });
  }

  async refresh(refreshToken: string): Promise<SessionTokens> {
    const session = await this.db.session.findUnique({ where: { tokenHash: hashToken(refreshToken) }, include: { user: { include: { roles: { include: { role: true } } } } } });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.isActive || session.user.deletedAt) throw new AuthError("SESSION_EXPIRED", 401);
    const result = await this.db.session.updateMany({ where: { id: session.id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (result.count !== 1) throw new AuthError("SESSION_REUSE_DETECTED", 401);
    return this.issueSession(toAuthUser(session.user));
  }

  async logout(refreshToken?: string) { if (refreshToken) await this.db.session.updateMany({ where: { tokenHash: hashToken(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } }); }
  async findUser(id: string) { const user = await this.db.user.findUnique({ where: { id }, include: { roles: { include: { role: true } } } }); return user && user.isActive && !user.deletedAt ? toAuthUser(user) : null; }
  private async issueSession(user: AuthUser): Promise<SessionTokens> { const refreshToken = createRefreshToken(); await this.db.session.create({ data: { userId: user.id, tokenHash: hashToken(refreshToken), expiresAt: new Date(Date.now() + config.REFRESH_TOKEN_TTL_DAYS * 86400000) } }); return { accessToken: await createAccessToken(user.id, user.roles), refreshToken, user }; }
}

function toAuthUser(user: { id: string; email: string | null; phone: string | null; displayName: string; roles: Array<{ role: { code: RoleCode } }> }): AuthUser { return { id: user.id, email: user.email, phone: user.phone, displayName: user.displayName, roles: user.roles.map((item) => item.role.code) }; }

export function validatePassword(password: string) { if (password.length < 12 || password.length > 128 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) throw new AuthError("WEAK_PASSWORD", 422); }

export const authService = new AuthService();
