import { Router } from "express";
import { asyncHandler, requireAuth } from "../auth/middleware.js";
import { notificationService } from "./service.js";

const router = Router();
router.get("/notifications", requireAuth, asyncHandler(async (request, response) => { response.json({ notifications: await notificationService.listForUser(request.auth!.id) }); }));
export { router as notificationRouter };
