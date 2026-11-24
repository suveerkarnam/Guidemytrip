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

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: config.WEB_ORIGIN, credentials: true }));
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-7", legacyHeaders: false }));
app.use(pinoHttp());

app.get("/api/v1/health", (_request, response) => {
  response.status(200).json({ status: "ok", service: "guidemytrip-api", timestamp: new Date().toISOString() });
});

app.use("/api/v1/auth", authRouter);

app.use((_request, response) => response.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } }));

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  void _next;
  if (error instanceof z.ZodError) { response.status(422).json({ error: { code: "VALIDATION_ERROR", message: "Request validation failed", fields: error.flatten().fieldErrors } }); return; }
  if (error instanceof AuthError) { response.status(error.status).json({ error: { code: error.code, message: "Authentication request could not be completed" } }); return; }
  console.error(error instanceof Error ? error.message : "Unexpected error");
  response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } });
};
app.use(errorHandler);
