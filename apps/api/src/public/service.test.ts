import { describe, expect, it, vi } from "vitest";
import { PublicService } from "./service.js";

describe("public contact service", () => {
  it("persists a validated contact payload", async () => {
    const db = { contactMessage: { create: vi.fn().mockResolvedValue({ id: "contact-1", status: "NEW" }) } };
    const result = await new PublicService(db as never).submitContact({ name: "A Traveller", email: "traveller@example.test", mobile: "+919000000000", subject: "Question", message: "I would like to know more." });
    expect(result).toEqual({ id: "contact-1", status: "NEW" });
    expect(db.contactMessage.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ mobile: "+919000000000" }) }));
  });
});
