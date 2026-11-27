import { Router } from "express";
import { z } from "zod";
import { asyncHandler, requireAuth, requireCsrf } from "../auth/middleware.js";
import { paymentService } from "./service.js";

const router = Router();
const orderSchema = z.object({ bookingId: z.string().uuid() });
const verificationSchema = z.object({ bookingId: z.string().uuid(), razorpayOrderId: z.string().min(1), razorpayPaymentId: z.string().min(1), razorpaySignature: z.string().min(1) });

router.post("/payments/orders", requireAuth, requireCsrf, asyncHandler(async (request, response) => {
  const input = orderSchema.parse(request.body);
  const idempotencyKey = request.get("Idempotency-Key")?.trim() || `booking:${input.bookingId}`;
  response.status(201).json(await paymentService.createOrder({ bookingId: input.bookingId, userId: request.auth!.id, idempotencyKey }));
}));

router.post("/payments/verify", requireAuth, requireCsrf, asyncHandler(async (request, response) => {
  const input = verificationSchema.parse(request.body);
  response.json(await paymentService.verifyPayment(request.auth!.id, { bookingId: input.bookingId, orderId: input.razorpayOrderId, paymentId: input.razorpayPaymentId, signature: input.razorpaySignature }));
}));

router.post("/payments/webhook", asyncHandler(async (request, response) => {
  if (!Buffer.isBuffer(request.body)) { response.status(400).json({ error: { code: "RAW_BODY_REQUIRED", message: "Webhook body could not be verified" } }); return; }
  response.json(await paymentService.handleWebhook(request.body, request.get("x-razorpay-signature") ?? "", request.get("x-razorpay-event-id")));
}));

router.post("/payments/bookings/:bookingId/cancel", requireAuth, requireCsrf, asyncHandler(async (request, response) => {
  const bookingId = Array.isArray(request.params.bookingId) ? request.params.bookingId[0] : request.params.bookingId;
  const input = z.object({ reason: z.string().trim().max(500).optional() }).parse(request.body);
  response.json(await paymentService.cancelBooking(request.auth!.id, z.string().uuid().parse(bookingId), input.reason));
}));

export { router as paymentRouter };
