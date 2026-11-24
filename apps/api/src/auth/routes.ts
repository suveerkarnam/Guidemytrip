import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { AuthError, authService } from "./service.js";
import { verifyGoogleIdentity } from "./providers.js";
import { asyncHandler, clearAuthCookies, csrfToken, requireAuth, requireCsrf, REFRESH_COOKIE, setAuthCookies } from "./middleware.js";

const router = Router();
const authMutationLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false, message: { error: { code: "AUTH_RATE_LIMITED", message: "Too many authentication attempts" } } });
const resetLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false, message: { error: { code: "RESET_RATE_LIMITED", message: "Too many password reset requests" } } });
const loginSchema = z.object({ identifier: z.string().trim().min(1).max(160), password: z.string().min(1).max(128) });
const signupSchema = z.object({ displayName: z.string().trim().min(2).max(80), phone: z.string().min(8).max(20), email: z.string().trim().email().optional().or(z.literal("")), password: z.string().min(1).max(128), confirmPassword: z.string().min(1).max(128) }).superRefine((value, context) => { if (value.password !== value.confirmPassword) context.addIssue({ code: z.ZodIssueCode.custom, path: ["confirmPassword"], message: "Passwords do not match" }); });
const emailSchema = z.object({ email: z.string().trim().email() });
const resetSchema = z.object({ token: z.string().min(20).max(256), password: z.string().min(1).max(128), confirmPassword: z.string().min(1).max(128) }).superRefine((value, context) => { if (value.password !== value.confirmPassword) context.addIssue({ code: z.ZodIssueCode.custom, path: ["confirmPassword"], message: "Passwords do not match" }); });
const googleSchema = z.object({ idToken: z.string().min(20) });

router.get("/csrf", (_request, response) => response.json({ csrfToken: csrfToken(response) }));
router.get("/me", requireAuth, (request, response) => response.json({ user: request.auth }));
router.use(requireCsrf);

const signupHandler = asyncHandler(async (request, response) => { const input = signupSchema.parse(request.body); const result = await authService.signup(input); setAuthCookies(response, result.accessToken, result.refreshToken); response.status(201).json({ user: result.user }); });
const loginHandler = asyncHandler(async (request, response) => { const input = loginSchema.parse(request.body); const result = await authService.login(input.identifier, input.password); setAuthCookies(response, result.accessToken, result.refreshToken); response.json({ user: result.user }); });
router.post("/signup", authMutationLimiter, signupHandler);
router.post("/login", authMutationLimiter, loginHandler);
router.post("/forgot-password", resetLimiter, asyncHandler(async (request, response) => { const input = emailSchema.parse(request.body); response.status(202).json(await authService.requestPasswordReset(input.email)); }));
router.post("/reset-password", resetLimiter, asyncHandler(async (request, response) => { const input = resetSchema.parse(request.body); await authService.resetPassword(input.token, input.password); response.json({ message: "Password reset successfully" }); }));
router.post("/google", authMutationLimiter, asyncHandler(async (request, response) => { const input = googleSchema.parse(request.body); const identity = await verifyGoogleIdentity(input.idToken); const result = await authService.loginWithGoogle(identity); setAuthCookies(response, result.accessToken, result.refreshToken); response.json({ user: result.user }); }));
router.post("/google/link", requireAuth, asyncHandler(async (request, response) => { const input = googleSchema.parse(request.body); const identity = await verifyGoogleIdentity(input.idToken); const result = await authService.loginWithGoogle(identity, request.auth!.id); setAuthCookies(response, result.accessToken, result.refreshToken); response.json({ user: result.user }); }));
router.post("/refresh", authMutationLimiter, asyncHandler(async (request, response) => { const token = request.cookies?.[REFRESH_COOKIE]; if (!token) throw new AuthError("SESSION_EXPIRED", 401); const result = await authService.refresh(token); setAuthCookies(response, result.accessToken, result.refreshToken); response.json({ user: result.user }); }));
router.post("/logout", asyncHandler(async (request, response) => { await authService.logout(request.cookies?.[REFRESH_COOKIE]); clearAuthCookies(response); response.status(204).send(); }));

export { router as authRouter };
