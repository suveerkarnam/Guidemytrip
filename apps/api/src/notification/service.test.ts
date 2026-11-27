import { describe, expect, it, vi } from "vitest";
import { NotificationService } from "./service.js";

describe("notification delivery", () => {
  it("marks a delivered email as sent and records the attempt", async () => {
    const db = { notification: { findUnique: vi.fn().mockResolvedValue({ id: "n-1", status: "PENDING", attemptCount: 0, channel: "EMAIL", subject: "Hello", body: "Body", user: { email: "traveller@example.test" } }), update: vi.fn().mockResolvedValue({ id: "n-1", status: "SENT" }) } };
    const result = await new NotificationService(db as never).deliver("n-1");
    expect(result).toMatchObject({ status: "SENT" });
    expect(db.notification.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "SENT", attemptCount: { increment: 1 } }) }));
  });

  it("records a failed attempt when no recipient is configured", async () => {
    const db = { notification: { findUnique: vi.fn().mockResolvedValue({ id: "n-2", status: "PENDING", attemptCount: 0, channel: "EMAIL", subject: "Hello", body: "Body", user: { email: null } }), update: vi.fn().mockResolvedValue({ id: "n-2", status: "FAILED" }) } };
    const result = await new NotificationService(db as never).deliver("n-2");
    expect(result).toMatchObject({ status: "FAILED" });
    expect(db.notification.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ errorMessage: expect.any(String) }) }));
  });
});
