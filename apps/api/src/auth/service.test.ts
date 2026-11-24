import { describe, expect, it, vi } from "vitest";
import { AuthService } from "./service";
import { hashOtp } from "./crypto";
import { mockSmsProvider } from "./providers";

function makeDatabase(otp: { id: string; createdAt: Date; expiresAt: Date; attempts: number; codeHash: string } | null) {
  const user = { id: "user-1", email: null, phone: "+919876543210", displayName: "Demo Traveller", roles: [{ role: { code: "TOURIST" as const } }] };
  const db = {
    otpVerification: { findFirst: vi.fn().mockResolvedValue(otp), create: vi.fn(), update: vi.fn().mockResolvedValue(otp) },
    role: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "role-1", code: "TOURIST" }) },
    user: { findUnique: vi.fn().mockResolvedValue(user), update: vi.fn(), create: vi.fn().mockResolvedValue(user) },
    userRole: { upsert: vi.fn() },
    session: { create: vi.fn() },
    $transaction: vi.fn(async (callback: (transaction: typeof db) => unknown) => callback(db)),
  };
  return db;
}

describe("mobile OTP service", () => {
  it("creates a hashed OTP through the provider without returning the code", async () => {
    const db = makeDatabase(null);
    const service = new AuthService(db as never);
    const result = await service.requestMobileOtp("+91 98765 43210");
    expect(result).not.toHaveProperty("code");
    expect(db.otpVerification.create).toHaveBeenCalledOnce();
    expect(mockSmsProvider.getLastDeliveryForTests()?.code).toMatch(/^\d{6}$/);
    expect((db.otpVerification.create.mock.calls[0]?.[0] as { data: { codeHash: string } }).data.codeHash).toBe(hashOtp(mockSmsProvider.getLastDeliveryForTests()!.code));
  });

  it("rejects expired OTPs and increments failed attempts", async () => {
    const db = makeDatabase({ id: "otp-1", createdAt: new Date(), expiresAt: new Date(Date.now() - 1000), attempts: 0, codeHash: hashOtp("123456") });
    const service = new AuthService(db as never);
    await expect(service.verifyMobileOtp("+919876543210", "123456")).rejects.toMatchObject({ code: "OTP_EXPIRED" });
  });

  it("rejects invalid OTPs without exposing the expected value", async () => {
    const db = makeDatabase({ id: "otp-1", createdAt: new Date(), expiresAt: new Date(Date.now() + 100000), attempts: 0, codeHash: hashOtp("123456") });
    const service = new AuthService(db as never);
    await expect(service.verifyMobileOtp("+919876543210", "000000")).rejects.toMatchObject({ code: "INVALID_OTP" });
    expect(db.otpVerification.update).toHaveBeenCalledOnce();
  });
});
