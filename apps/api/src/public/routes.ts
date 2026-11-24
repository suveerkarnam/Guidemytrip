import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { asyncHandler } from "../auth/middleware.js";
import { publicService } from "./service.js";

const router = Router();
const contactLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false, message: { error: { code: "CONTACT_RATE_LIMITED", message: "Too many contact requests" } } });
const contactSchema = z.object({ name: z.string().trim().min(2).max(100), email: z.string().email(), mobile: z.string().trim().max(20).optional(), subject: z.string().trim().min(3).max(160), message: z.string().trim().min(10).max(3000) });
router.get("/reviews/public", asyncHandler(async (_request, response) => { response.json({ reviews: await publicService.approvedReviews() }); }));
router.post("/contact", contactLimiter, asyncHandler(async (request, response) => { const input = contactSchema.parse(request.body); const userId = request.auth?.id; response.status(201).json(await publicService.submitContact({ ...input, userId })); }));
export { router as publicRouter };
