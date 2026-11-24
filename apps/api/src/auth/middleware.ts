import { randomBytes } from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { RoleCode } from "@prisma/client";
import { config } from "../config.js";
import { authService } from "./service.js";
import { verifyAccessToken } from "./crypto.js";

export const ACCESS_COOKIE = "gt_access";
export const REFRESH_COOKIE = "gt_refresh";
export const CSRF_COOKIE = "gt_csrf";

const cookieOptions = { httpOnly: true, secure: config.COOKIE_SECURE || config.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };

export function setAuthCookies(response: Response, accessToken: string, refreshToken: string) {
  response.cookie(ACCESS_COOKIE, accessToken, { ...cookieOptions, maxAge: config.ACCESS_TOKEN_TTL_SECONDS * 1000 });
  response.cookie(REFRESH_COOKIE, refreshToken, { ...cookieOptions, maxAge: config.REFRESH_TOKEN_TTL_DAYS * 86400000 });
}

export function clearAuthCookies(response: Response) { response.clearCookie(ACCESS_COOKIE, cookieOptions); response.clearCookie(REFRESH_COOKIE, cookieOptions); response.clearCookie(CSRF_COOKIE, { ...cookieOptions, httpOnly: false }); }

export const requireCsrf: RequestHandler = (request, response, next) => { const cookie = request.cookies?.[CSRF_COOKIE]; const header = request.get("x-csrf-token"); if (!cookie || !header || cookie !== header) { response.status(403).json({ error: { code: "CSRF_INVALID", message: "CSRF validation failed" } }); return; } next(); };

export const requireAuth: RequestHandler = async (request, response, next) => {
  try {
    const token = request.cookies?.[ACCESS_COOKIE];
    if (!token) { response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } }); return; }
    const claims = await verifyAccessToken(token);
    const user = await authService.findUser(claims.sub!);
    if (!user) { response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } }); return; }
    request.auth = user;
    next();
  } catch { response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } }); }
};

export function requireRoles(...roles: RoleCode[]): RequestHandler { return (request, response, next) => { if (!request.auth || !roles.some((role) => request.auth!.roles.includes(role))) { response.status(403).json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }); return; } next(); }; }

export function requireOwnership(getOwnerId: (request: Request) => string | undefined): RequestHandler { return (request, response, next) => { if (!request.auth || request.auth.id !== getOwnerId(request)) { response.status(403).json({ error: { code: "FORBIDDEN", message: "Resource ownership required" } }); return; } next(); }; }

export function csrfToken(response: Response) { const token = randomBytes(24).toString("base64url"); response.cookie(CSRF_COOKIE, token, { secure: config.COOKIE_SECURE || config.NODE_ENV === "production", sameSite: "lax", httpOnly: false, maxAge: config.REFRESH_TOKEN_TTL_DAYS * 86400000, path: "/" }); return token; }

export function asyncHandler(handler: (request: Request, response: Response, next: NextFunction) => Promise<void>): RequestHandler { return (request, response, next) => { void handler(request, response, next).catch(next); }; }
