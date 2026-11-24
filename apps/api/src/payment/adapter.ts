import { createHmac, randomBytes } from "node:crypto";
import Razorpay from "razorpay";
import { config } from "../config.js";

export type ProviderOrder = { id: string; amount: number; currency: string; status: string };
export type ProviderRefund = { id: string; status: string };

export interface PaymentGateway {
  createOrder(input: { amount: number; currency: string; receipt: string; notes: Record<string, string> }): Promise<ProviderOrder>;
  refundPayment(paymentId: string, amount: number, notes: Record<string, string>): Promise<ProviderRefund>;
}

class MockPaymentGateway implements PaymentGateway {
  async createOrder(input: { amount: number; currency: string; receipt: string }) {
    return { id: `order_mock_${randomBytes(12).toString("hex")}`, amount: input.amount, currency: input.currency, status: "created" };
  }

  async refundPayment(paymentId: string, amount: number) {
    void paymentId;
    void amount;
    return { id: `rfnd_mock_${randomBytes(12).toString("hex")}`, status: "processed" };
  }
}

class RazorpayPaymentGateway implements PaymentGateway {
  private readonly client: Razorpay;

  constructor() {
    if (!config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET) throw new Error("Razorpay credentials are not configured");
    this.client = new Razorpay({ key_id: config.RAZORPAY_KEY_ID, key_secret: config.RAZORPAY_KEY_SECRET });
  }

  async createOrder(input: { amount: number; currency: string; receipt: string; notes: Record<string, string> }) {
    return this.client.orders.create({ amount: input.amount, currency: input.currency, receipt: input.receipt, notes: input.notes }) as Promise<ProviderOrder>;
  }

  async refundPayment(paymentId: string, amount: number, notes: Record<string, string>) {
    return this.client.payments.refund(paymentId, { amount, notes }) as Promise<ProviderRefund>;
  }
}

export const paymentGateway: PaymentGateway = config.PAYMENT_PROVIDER === "razorpay" ? new RazorpayPaymentGateway() : new MockPaymentGateway();

export function paymentSignature(orderId: string, paymentId: string, secret: string) {
  return createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
}

export function webhookSignature(payload: Buffer, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}
