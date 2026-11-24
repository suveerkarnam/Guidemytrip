import { describe, expect, it } from "vitest";
import { createRefreshToken, hashOtp, hashPassword, hashToken, verifyPassword } from "./crypto";

describe("authentication cryptography", () => {
  it("hashes OTPs and never returns the original value", () => {
    expect(hashOtp("123456")).not.toBe("123456");
    expect(hashOtp("123456")).toBe(hashOtp("123456"));
  });

  it("verifies scrypt password hashes and rejects another password", () => {
    const hash = hashPassword("StrongPassword123");
    expect(verifyPassword("StrongPassword123", hash)).toBe(true);
    expect(verifyPassword("WrongPassword123", hash)).toBe(false);
  });

  it("creates opaque refresh tokens that are only stored as hashes", () => {
    const token = createRefreshToken();
    expect(token.length).toBeGreaterThan(40);
    expect(hashToken(token)).not.toBe(token);
  });
});
