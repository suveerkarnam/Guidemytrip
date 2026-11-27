import { BookingStatus, PaymentStatus, Prisma, PrismaClient, RefundStatus } from "@prisma/client";
import { timingSafeEqual } from "node:crypto";
import { config } from "../config.js";
import { prisma as defaultPrisma } from "../db.js";
import { AuthError } from "../auth/service.js";
import { paymentGateway, paymentSignature, webhookSignature } from "./adapter.js";
import { NotificationType } from "@prisma/client";
import { notificationService } from "../notification/service.js";

type PaymentInput = { bookingId: string; userId: string; idempotencyKey: string };

export class PaymentService {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async createOrder(input: PaymentInput) {
    // Keep mock and Razorpay orders separate. This prevents a pending order created
    // in local mock mode from being reused after switching the API to Razorpay test mode.
    const providerIdempotencyKey = `${input.idempotencyKey}:${config.PAYMENT_PROVIDER}`;
    const existing = await this.db.payment.findUnique({ where: { idempotencyKey: providerIdempotencyKey }, include: { booking: true } });
    if (existing) {
      if (existing.booking.touristId !== input.userId || existing.bookingId !== input.bookingId) throw new AuthError("PAYMENT_IDEMPOTENCY_CONFLICT", 409);
      return this.serializeOrder(existing);
    }
    const booking = await this.db.booking.findUnique({ where: { id: input.bookingId }, include: { package: { include: { cancellationPolicy: true } }, holds: { where: { releasedAt: null }, orderBy: { createdAt: "desc" }, take: 1 }, payments: { orderBy: { createdAt: "desc" } } } });
    if (!booking || booking.touristId !== input.userId) throw new AuthError("BOOKING_NOT_FOUND", 404);
    if (booking.bookingStatus !== BookingStatus.PENDING_PAYMENT) throw new AuthError("BOOKING_NOT_PAYABLE", 409);
    const hold = booking.holds[0];
    if (!hold || hold.expiresAt <= new Date()) throw new AuthError("HOLD_EXPIRED", 409);
    if (booking.payments.some((payment) => payment.status === PaymentStatus.CAPTURED)) throw new AuthError("BOOKING_ALREADY_PAID", 409);
    const recalculated = new Prisma.Decimal(booking.package.basePrice).mul(booking.tourists12Plus).mul(new Prisma.Decimal(1).plus(new Prisma.Decimal(booking.package.gstRate).div(100)));
    if (recalculated.toFixed(2) !== booking.totalAmount.toFixed(2)) throw new AuthError("BOOKING_AMOUNT_CHANGED", 409);
    const providerOrder = await paymentGateway.createOrder({ amount: recalculated.mul(100).toNumber(), currency: booking.currency, receipt: booking.reference, notes: { bookingId: booking.id, reference: booking.reference } });
    const payment = await this.db.payment.create({ data: { bookingId: booking.id, provider: config.PAYMENT_PROVIDER, providerOrderId: providerOrder.id, amount: booking.totalAmount, currency: booking.currency, status: PaymentStatus.PENDING, idempotencyKey: providerIdempotencyKey } });
    return this.serializeOrder(payment, booking.reference);
  }

  async verifyPayment(userId: string, input: { bookingId: string; orderId: string; paymentId: string; signature: string }) {
    const result = await this.capturePayment(input, userId, input.signature, true);
    return result;
  }

  async handleWebhook(rawBody: Buffer, signature: string, eventId: string | undefined) {
    const secret = config.RAZORPAY_WEBHOOK_SECRET;
    if (!secret || !safeEqual(webhookSignature(rawBody, secret), signature)) throw new AuthError("INVALID_WEBHOOK_SIGNATURE", 401);
    let payload: WebhookPayload;
    try { payload = JSON.parse(rawBody.toString("utf8")) as WebhookPayload; } catch { throw new AuthError("INVALID_WEBHOOK_PAYLOAD", 400); }
    const providerEventId = eventId || webhookSignature(rawBody, secret);
    const entity = payload.payload?.payment?.entity ?? payload.payload?.refund?.entity;
    const providerOrderId = entity?.order_id;
    const providerPaymentId = entity?.id ?? entity?.payment_id;
    if (!providerOrderId && !providerPaymentId) return { received: true, ignored: true };
    const payment = await this.db.payment.findFirst({ where: { OR: [{ providerOrderId: providerOrderId ?? undefined }, { providerPaymentId: providerPaymentId ?? undefined }] } });
    if (!payment) return { received: true, ignored: true };
    const duplicate = await this.db.paymentEvent.findUnique({ where: { providerEventId } });
    if (duplicate) return { received: true, duplicate: true };
    if ((payload.event === "payment.captured" || payload.event === "order.paid") && providerPaymentId) await this.capturePayment({ bookingId: payment.bookingId, orderId: payment.providerOrderId ?? providerOrderId!, paymentId: providerPaymentId, signature: "webhook" }, undefined, undefined, false);
    if (payload.event === "payment.failed") await this.db.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.FAILED } });
    if ((payload.event === "refund.processed" || payload.event === "refund.failed") && providerPaymentId) await this.updateRefundFromWebhook(providerPaymentId, payload.event);
    try { await this.db.paymentEvent.create({ data: { paymentId: payment.id, providerEventId, eventType: payload.event, status: payment.status, payload } }); } catch (error) { if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error; }
    return { received: true };
  }

  async cancelBooking(userId: string, bookingId: string, reason?: string) {
    const booking = await this.db.booking.findUnique({ where: { id: bookingId }, include: { package: { include: { cancellationPolicy: true } }, payments: { where: { status: { in: [PaymentStatus.CAPTURED, PaymentStatus.PARTIALLY_REFUNDED] } }, orderBy: { createdAt: "desc" }, take: 1 }, holds: { where: { releasedAt: null } } } });
    if (!booking || booking.touristId !== userId) throw new AuthError("BOOKING_NOT_FOUND", 404);
    if (booking.bookingStatus === BookingStatus.CANCELLED || booking.bookingStatus === BookingStatus.COMPLETED) throw new AuthError("BOOKING_NOT_CANCELLABLE", 409);
    const payment = booking.payments[0];
    const refundable = payment ? (booking.package.cancellationPolicy && booking.startDate.getTime() - Date.now() >= booking.package.cancellationPolicy.freeCancellationHours * 3600000 ? booking.totalAmount : new Prisma.Decimal(0)) : new Prisma.Decimal(0);
    const result = await this.db.$transaction(async (tx) => {
      const updated = await tx.booking.update({ where: { id: booking.id }, data: { bookingStatus: BookingStatus.CANCELLED, paymentStatus: payment && refundable.gt(0) ? PaymentStatus.PENDING : booking.paymentStatus }, });
      await tx.bookingCancellation.create({ data: { bookingId: booking.id, cancelledBy: userId, actor: "TOURIST", reason } });
      await tx.bookingHold.updateMany({ where: { bookingId: booking.id, releasedAt: null }, data: { releasedAt: new Date() } });
      if (payment && refundable.gt(0)) await tx.refund.create({ data: { bookingId: booking.id, paymentId: payment.id, amount: refundable, currency: booking.currency, reason: reason ?? "Booking cancellation" } });
      return { booking: updated, payment, refundable };
    });
    if (result.payment && result.refundable.gt(0) && result.payment.providerPaymentId) {
      try { const providerRefund = await paymentGateway.refundPayment(result.payment.providerPaymentId, result.refundable.mul(100).toNumber(), { bookingId }); await this.db.refund.updateMany({ where: { bookingId, status: RefundStatus.PENDING }, data: { providerRefundId: providerRefund.id, status: providerRefund.status === "processed" ? RefundStatus.PROCESSED : RefundStatus.PENDING } }); await this.db.payment.update({ where: { id: result.payment.id }, data: { status: PaymentStatus.REFUNDED } }); } catch { await this.db.refund.updateMany({ where: { bookingId, status: RefundStatus.PENDING }, data: { status: RefundStatus.FAILED } }); }
    }
    return { bookingStatus: result.booking.bookingStatus, refundAmount: result.refundable.toFixed(2) };
  }

  private async capturePayment(input: { bookingId: string; orderId: string; paymentId: string; signature: string }, userId?: string, signature?: string, verifySignature = true) {
    if (verifySignature) { const secret = config.RAZORPAY_KEY_SECRET; if (!secret || !safeEqual(paymentSignature(input.orderId, input.paymentId, secret), signature ?? "")) throw new AuthError("INVALID_PAYMENT_SIGNATURE", 400); }
    const result = await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`payment:${input.bookingId}`}, 0))`;
      const payment = await tx.payment.findFirst({ where: { bookingId: input.bookingId, providerOrderId: input.orderId } });
      if (!payment) throw new AuthError("PAYMENT_NOT_FOUND", 404);
      const booking = await tx.booking.findUnique({ where: { id: input.bookingId }, include: { tourist: true, guide: { include: { user: true } }, holds: { where: { bookingId: input.bookingId }, orderBy: { createdAt: "desc" }, take: 1 } } });
      if (!booking || (userId && booking.touristId !== userId)) throw new AuthError("BOOKING_NOT_FOUND", 404);
      if (payment.status === PaymentStatus.CAPTURED && payment.providerPaymentId === input.paymentId) return { kind: "duplicate" as const, bookingId: booking.id, bookingStatus: booking.bookingStatus, paymentStatus: payment.status };
      if (payment.providerPaymentId && payment.providerPaymentId !== input.paymentId) throw new AuthError("PAYMENT_ALREADY_PROCESSED", 409);
      const hold = booking.holds[0];
      if (!hold || hold.expiresAt <= new Date()) {
        await tx.payment.update({ where: { id: payment.id }, data: { providerPaymentId: input.paymentId, status: PaymentStatus.CAPTURED } });
        await tx.booking.update({ where: { id: booking.id }, data: { paymentStatus: PaymentStatus.CAPTURED, bookingStatus: BookingStatus.CANCELLED } });
        await tx.refund.create({ data: { bookingId: booking.id, paymentId: payment.id, amount: booking.totalAmount, currency: booking.currency, reason: "Late payment after booking hold expiry" } });
        return { kind: "late" as const, bookingId: booking.id, paymentId: payment.id, amount: booking.totalAmount, reference: booking.reference };
      }
      const savedPayment = await tx.payment.update({ where: { id: payment.id }, data: { providerPaymentId: input.paymentId, status: PaymentStatus.CAPTURED } });
      const savedBooking = await tx.booking.update({ where: { id: booking.id }, data: { bookingStatus: BookingStatus.CONFIRMED, paymentStatus: PaymentStatus.CAPTURED } });
      await tx.bookingHold.update({ where: { id: hold.id }, data: { releasedAt: new Date() } });
      return { kind: "confirmed" as const, bookingId: savedBooking.id, bookingStatus: savedBooking.bookingStatus, paymentStatus: savedPayment.status, touristId: booking.touristId, guideUserId: booking.guide.userId, reference: booking.reference };
    });
    if (result.kind === "duplicate") return result;
    if (result.kind === "late") {
      try { const providerRefund = await paymentGateway.refundPayment(input.paymentId, result.amount.mul(100).toNumber(), { bookingId: result.bookingId, reason: "late_payment_hold_expired" }); await this.db.refund.updateMany({ where: { bookingId: result.bookingId, status: RefundStatus.PENDING }, data: { providerRefundId: providerRefund.id, status: providerRefund.status === "processed" ? RefundStatus.PROCESSED : RefundStatus.PENDING } }); await this.db.payment.update({ where: { id: result.paymentId }, data: { status: PaymentStatus.REFUNDED } }); } catch { await this.db.refund.updateMany({ where: { bookingId: result.bookingId, status: RefundStatus.PENDING }, data: { status: RefundStatus.FAILED } }); }
      return { bookingId: result.bookingId, bookingStatus: BookingStatus.CANCELLED, paymentStatus: PaymentStatus.REFUNDED, refundRequired: true };
    }
    void notificationService.enqueue({ userId: result.touristId, type: NotificationType.PAYMENT_CONFIRMED, subject: `Payment confirmed for ${result.reference}`, body: "Your payment was verified successfully." });
    void notificationService.enqueue({ userId: result.touristId, type: NotificationType.BOOKING_CONFIRMED, subject: `Booking ${result.reference} confirmed`, body: "Your GuideMyTrip booking is confirmed. We look forward to having you." });
    void notificationService.enqueue({ userId: result.guideUserId, type: NotificationType.GUIDE_BOOKING, subject: `New booking ${result.reference}`, body: "A new paid booking has been confirmed for your guide profile." });
    return { bookingId: result.bookingId, bookingStatus: result.bookingStatus, paymentStatus: result.paymentStatus };
  }

  private async updateRefundFromWebhook(providerPaymentId: string, event: string) { const payment = await this.db.payment.findFirst({ where: { providerPaymentId } }); if (!payment) return; await this.db.refund.updateMany({ where: { paymentId: payment.id, status: RefundStatus.PENDING }, data: { status: event === "refund.processed" ? RefundStatus.PROCESSED : RefundStatus.FAILED } }); }
  private serializeOrder(payment: { id: string; providerOrderId: string | null; amount: Prisma.Decimal; currency: string; status: PaymentStatus }, reference?: string) { if (!payment.providerOrderId) throw new AuthError("PAYMENT_ORDER_UNAVAILABLE", 502); if (config.PAYMENT_PROVIDER === "razorpay" && payment.providerOrderId.startsWith("order_mock_")) throw new AuthError("PAYMENT_PROVIDER_MISCONFIGURED", 502); return { paymentId: payment.id, orderId: payment.providerOrderId, amount: payment.amount.mul(100).toNumber(), currency: payment.currency, keyId: config.RAZORPAY_KEY_ID ?? "test_key", reference }; }
}

type WebhookPayload = { event: string; payload?: { payment?: { entity?: { id?: string; order_id?: string; payment_id?: string } }; refund?: { entity?: { id?: string; payment_id?: string; order_id?: string } } } };
function safeEqual(left: string, right: string) { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); }
export const paymentService = new PaymentService();
