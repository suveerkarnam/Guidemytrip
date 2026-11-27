import { describe, expect, it } from "vitest";
import { createRefreshToken, hashPassword, hashToken, verifyPassword } from "./crypto";

describe("authentication cryptography", () => {
  it("uses bcrypt password hashes and rejects another password", () => {
    const hash = hashPassword("StrongPassword123");
    expect(hash.startsWith("$2")).toBe(true);
    expect(verifyPassword("StrongPassword123", hash)).toBe(true);
    expect(verifyPassword("WrongPassword123", hash)).toBe(false);
  });
  it("creates opaque refresh tokens that are only stored as hashes", () => { const token = createRefreshToken(); expect(token.length).toBeGreaterThan(40); expect(hashToken(token)).not.toBe(token); });
});
