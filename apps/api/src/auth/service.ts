import { AuthProviderType, OtpPurpose, PrismaClient, RoleCode } from "@prisma/client";
import { config } from "../config.js";
import { prisma as defaultPrisma } from "../db.js";
import { createAccessToken, createRefreshToken, hashOtp, hashPassword, hashToken, verifyPassword } from "./crypto.js";
import { smsProvider, type VerifiedGoogleIdentity } from "./providers.js";
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

export type SessionTokens = { accessToken: string; refreshToken: string; user: AuthUser };

export class AuthService {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async requestMobileOtp(phoneInput: string) {
    const phone = normalizePhone(phoneInput);
    const latest = await this.db.otpVerification.findFirst({ where: { identifier: phone, purpose: OtpPurpose.SIGN_IN }, orderBy: { createdAt: "desc" } });
    if (latest && Date.now() - latest.createdAt.getTime() < config.OTP_RESEND_COOLDOWN_SECONDS * 1000) throw new AuthError("OTP_RESEND_COOLDOWN", 429);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await smsProvider.sendOtp(phone, code, config.OTP_TTL_SECONDS);
    await this.db.otpVerification.create({ data: {
      identifier: phone,
      purpose: OtpPurpose.SIGN_IN,
      codeHash: hashOtp(code),
      expiresAt: new Date(Date.now() + config.OTP_TTL_SECONDS * 1000),
      user: { connectOrCreate: { where: { phone }, create: { phone, displayName: `Traveller ${phone.slice(-4)}`, roles: { create: { role: { connect: { code: RoleCode.TOURIST } } } } } } },
    } });
    return { expiresInSeconds: config.OTP_TTL_SECONDS, resendAfterSeconds: config.OTP_RESEND_COOLDOWN_SECONDS };
  }

  async verifyMobileOtp(phoneInput: string, code: string): Promise<SessionTokens> {
    const phone = normalizePhone(phoneInput);
    if (!/^\d{6}$/.test(code)) throw new AuthError("INVALID_OTP", 422);
    const otp = await this.db.otpVerification.findFirst({ where: { identifier: phone, purpose: OtpPurpose.SIGN_IN, consumedAt: null }, orderBy: { createdAt: "desc" } });
    if (!otp || otp.expiresAt.getTime() <= Date.now()) throw new AuthError("OTP_EXPIRED", 401);
    if (otp.attempts >= config.OTP_MAX_ATTEMPTS) throw new AuthError("OTP_ATTEMPTS_EXCEEDED", 429);
    if (hashOtp(code) !== otp.codeHash) { await this.db.otpVerification.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } }); throw new AuthError("INVALID_OTP", 401); }
    const user = await this.db.$transaction(async (transaction) => {
      await transaction.otpVerification.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
      const role = await transaction.role.findUniqueOrThrow({ where: { code: RoleCode.TOURIST } });
      const existing = await transaction.user.findUnique({ where: { phone }, include: { roles: { include: { role: true } } } });
      if (existing) { await transaction.user.update({ where: { id: existing.id }, data: { phoneVerifiedAt: new Date() } }); await transaction.userRole.upsert({ where: { userId_roleId: { userId: existing.id, roleId: role.id } }, update: {}, create: { userId: existing.id, roleId: role.id } }); return transaction.user.findUniqueOrThrow({ where: { id: existing.id }, include: { roles: { include: { role: true } } } }); }
      return transaction.user.create({ data: { phone, phoneVerifiedAt: new Date(), displayName: `Traveller ${phone.slice(-4)}`, roles: { create: { roleId: role.id } }, }, include: { roles: { include: { role: true } } } });
    });
    return this.issueSession(toAuthUser(user));
  }

  async signupWithPassword(emailInput: string, password: string, displayName: string): Promise<SessionTokens> {
    const email = normalizeEmail(emailInput);
    validatePassword(password);
    if (!displayName.trim()) throw new AuthError("INVALID_DISPLAY_NAME", 422);
    const existing = await this.db.user.findUnique({ where: { email } });
    if (existing) throw new AuthError("ACCOUNT_ALREADY_EXISTS", 409);
    const user = await this.db.user.create({ data: { email, displayName: displayName.trim(), passwordHash: hashPassword(password), roles: { create: { role: { connect: { code: RoleCode.TOURIST } } } } }, include: { roles: { include: { role: true } } } });
    return this.issueSession(toAuthUser(user));
  }

  async loginWithPassword(emailInput: string, password: string): Promise<SessionTokens> {
    const email = normalizeEmail(emailInput);
    const user = await this.db.user.findUnique({ where: { email }, include: { roles: { include: { role: true } } } });
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

function validatePassword(password: string) { if (password.length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) throw new AuthError("WEAK_PASSWORD", 422); }

export const authService = new AuthService();
