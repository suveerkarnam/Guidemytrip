import { describe, expect, it } from "vitest";
import { paymentSignature, webhookSignature } from "./adapter.js";

describe("payment signatures", () => {
  it("creates a deterministic payment signature", () => {
    expect(paymentSignature("order_test", "pay_test", "secret")).toBe(paymentSignature("order_test", "pay_test", "secret"));
    expect(paymentSignature("order_test", "pay_test", "secret")).not.toBe(paymentSignature("order_other", "pay_test", "secret"));
  });

  it("signs the exact webhook bytes", () => {
    const body = Buffer.from('{"event":"payment.captured"}');
    expect(webhookSignature(body, "secret")).toHaveLength(64);
    expect(webhookSignature(Buffer.from("{}"), "secret")).not.toBe(webhookSignature(body, "secret"));
  });
});
