import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { AuthError, authService } from "./service.js";
import { verifyGoogleIdentity } from "./providers.js";
import { asyncHandler, clearAuthCookies, csrfToken, requireAuth, requireCsrf, REFRESH_COOKIE, setAuthCookies } from "./middleware.js";

const router = Router();
const otpLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 5, standardHeaders: "draft-7", legacyHeaders: false, message: { error: { code: "OTP_RATE_LIMITED", message: "Too many OTP requests" } } });
const phoneSchema = z.object({ phone: z.string().min(8).max(20) });
const otpSchema = phoneSchema.extend({ code: z.string().length(6) });
const passwordSchema = z.object({ email: z.string().email(), password: z.string().min(12).max(128) });
const signupSchema = passwordSchema.extend({ displayName: z.string().trim().min(2).max(80) });
const googleSchema = z.object({ idToken: z.string().min(20) });

router.get("/csrf", (_request, response) => response.json({ csrfToken: csrfToken(response) }));
router.use(requireCsrf);

router.post("/otp/request", otpLimiter, asyncHandler(async (request, response) => { const input = phoneSchema.parse(request.body); response.status(202).json(await authService.requestMobileOtp(input.phone)); }));
router.post("/otp/verify", asyncHandler(async (request, response) => { const input = otpSchema.parse(request.body); const result = await authService.verifyMobileOtp(input.phone, input.code); setAuthCookies(response, result.accessToken, result.refreshToken); response.json({ user: result.user }); }));
router.post("/password/signup", asyncHandler(async (request, response) => { const input = signupSchema.parse(request.body); const result = await authService.signupWithPassword(input.email, input.password, input.displayName); setAuthCookies(response, result.accessToken, result.refreshToken); response.status(201).json({ user: result.user }); }));
router.post("/password/login", asyncHandler(async (request, response) => { const input = passwordSchema.parse(request.body); const result = await authService.loginWithPassword(input.email, input.password); setAuthCookies(response, result.accessToken, result.refreshToken); response.json({ user: result.user }); }));
router.post("/google", asyncHandler(async (request, response) => { const input = googleSchema.parse(request.body); const identity = await verifyGoogleIdentity(input.idToken); const result = await authService.loginWithGoogle(identity); setAuthCookies(response, result.accessToken, result.refreshToken); response.json({ user: result.user }); }));
router.post("/google/link", requireAuth, asyncHandler(async (request, response) => { const input = googleSchema.parse(request.body); const identity = await verifyGoogleIdentity(input.idToken); const result = await authService.loginWithGoogle(identity, request.auth!.id); setAuthCookies(response, result.accessToken, result.refreshToken); response.json({ user: result.user }); }));
router.post("/refresh", asyncHandler(async (request, response) => { const token = request.cookies?.[REFRESH_COOKIE]; if (!token) throw new AuthError("SESSION_EXPIRED", 401); const result = await authService.refresh(token); setAuthCookies(response, result.accessToken, result.refreshToken); response.json({ user: result.user }); }));
router.post("/logout", asyncHandler(async (request, response) => { await authService.logout(request.cookies?.[REFRESH_COOKIE]); clearAuthCookies(response); response.status(204).send(); }));
router.get("/me", requireAuth, (request, response) => response.json({ user: request.auth }));

export { router as authRouter };
