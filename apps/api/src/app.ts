import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { z } from "zod";
import { config } from "./config.js";
import { authRouter } from "./auth/routes.js";
import { AuthError } from "./auth/service.js";
import { bookingRouter } from "./booking/routes.js";
import { paymentRouter } from "./payment/routes.js";
import { dashboardRouter } from "./dashboard/routes.js";
import { notificationRouter } from "./notification/routes.js";
import { publicRouter } from "./public/routes.js";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: config.WEB_ORIGIN, credentials: true }));
app.use(compression());
app.use(cookieParser());
app.use("/api/v1/payments/webhook", express.raw({ type: "application/json", limit: "1mb" }));
app.use(express.json({ limit: "1mb" }));
app.use((_request, response, next) => { response.setHeader("Cache-Control", "no-store"); next(); });
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-7", legacyHeaders: false }));
app.use(pinoHttp({ redact: ["req.headers.cookie", "req.headers.authorization", "res.headers.set-cookie"] }));

app.get("/api/v1/health", (_request, response) => {
  response.status(200).json({ status: "ok", service: "guidemytrip-api", timestamp: new Date().toISOString() });
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1", bookingRouter);
app.use("/api/v1", paymentRouter);
app.use("/api/v1", dashboardRouter);
app.use("/api/v1", notificationRouter);
app.use("/api/v1", publicRouter);

app.use((_request, response) => response.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } }));

const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  void _next;
  if (error instanceof z.ZodError) { response.status(422).json({ error: { code: "VALIDATION_ERROR", message: "Request validation failed", fields: error.flatten().fieldErrors } }); return; }
  if (error instanceof AuthError) { response.status(error.status).json({ error: { code: error.code, message: "Authentication request could not be completed" } }); return; }
  request.log.error({ err: error instanceof Error ? { name: error.name, message: error.message } : undefined }, "request failed");
  response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } });
};
app.use(errorHandler);
