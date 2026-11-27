import { describe, expect, it, vi } from "vitest";
import { AuthService } from "./service";
import { hashPassword } from "./crypto";
import { mockEmailProvider } from "./email";

const user = { id: "user-1", email: "traveller@example.com", phone: "+919876543210", displayName: "Demo Traveller", isActive: true, deletedAt: null, passwordHash: hashPassword("StrongPassword123"), roles: [{ role: { code: "TOURIST" as const } }] };
function makeDatabase() {
  const db = {
    user: { findFirst: vi.fn().mockResolvedValue(user), findUnique: vi.fn().mockResolvedValue(user), create: vi.fn().mockResolvedValue(user), update: vi.fn() },
    role: { findUniqueOrThrow: vi.fn() }, userRole: { upsert: vi.fn() }, session: { create: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    passwordResetToken: { updateMany: vi.fn(), create: vi.fn(), findUnique: vi.fn() }, userAuthProvider: { findUnique: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(async (callback: (transaction: typeof db) => unknown) => callback(db)),
  };
  return db;
}

describe("password authentication service", () => {
  it("signs up a tourist with a normalized phone and password session", async () => {
    const db = makeDatabase(); const service = new AuthService(db as never);
    await service.signup({ displayName: " New Traveller ", phone: "+91 98765 43210", email: "NEW@EXAMPLE.COM", password: "StrongPassword123", confirmPassword: "StrongPassword123" } as never);
    expect(db.user.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ phone: "+919876543210", email: "new@example.com" }) }));
    expect(db.session.create).toHaveBeenCalledOnce();
  });

  it("authenticates using either email or mobile identifier", async () => {
    const db = makeDatabase(); const service = new AuthService(db as never);
    await service.login("TRAVELLER@EXAMPLE.COM", "StrongPassword123"); await service.login("+91 98765 43210", "StrongPassword123");
    expect(db.user.findFirst).toHaveBeenCalledTimes(2);
  });

  it("creates a reset token without exposing it and invalidates sessions after reset", async () => {
    const db = makeDatabase(); const service = new AuthService(db as never);
    await service.requestPasswordReset("TRAVELLER@EXAMPLE.COM");
    const delivery = mockEmailProvider.getLastDeliveryForTests(); expect(delivery?.resetUrl).toContain("/reset-password?token=");
    const tokenHash = (db.passwordResetToken.create.mock.calls[0]?.[0] as { data: { tokenHash: string } }).data.tokenHash; expect(tokenHash).not.toContain(delivery?.resetUrl.split("token=")[1]);
  });

  it("revokes the refresh session during logout", async () => {
    const db = makeDatabase(); const service = new AuthService(db as never);
    await service.logout("refresh-token");
    expect(db.session.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { revokedAt: expect.any(Date) } }));
  });
});
