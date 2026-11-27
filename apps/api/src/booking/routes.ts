import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireCsrf, asyncHandler } from "../auth/middleware.js";
import { bookingService } from "./service.js";

const router = Router();
const languageIdsSchema = z.preprocess((value) => typeof value === "string" ? value.split(",").map((item) => item.trim()).filter(Boolean) : value, z.array(z.string().uuid()).min(1).max(3));
export const discoverySchema = z.object({ destinationSlug: z.string().min(1), packageId: z.string().uuid(), from: z.string(), to: z.string(), tourists12Plus: z.coerce.number().int(), languageIds: languageIdsSchema });
const bookingSchema = discoverySchema.extend({ guideId: z.string().uuid(), holdId: z.string().uuid(), holdToken: z.string().min(20) });

router.get("/destinations", asyncHandler(async (_request, response) => { response.json(await bookingService.listDestinations()); }));
router.get("/languages", asyncHandler(async (_request, response) => { response.json({ languages: await bookingService.listLanguages() }); }));
router.get("/destinations/:slug", asyncHandler(async (request, response) => { response.json(await bookingService.getDestination(pathParam(request.params.slug))); }));
router.get("/destinations/:slug/packages", asyncHandler(async (request, response) => { response.json(await bookingService.listPackages(pathParam(request.params.slug))); }));
router.get("/guides/available", asyncHandler(async (request, response) => { const input = discoverySchema.parse(request.query); response.json({ guides: await bookingService.discoverGuides(input) }); }));

router.post("/booking-holds", requireAuth, requireCsrf, asyncHandler(async (request, response) => { const input = discoverySchema.extend({ guideId: z.string().uuid() }).parse(request.body); response.status(201).json(await bookingService.createHold(input)); }));
router.post("/booking-holds/:id/release", requireAuth, requireCsrf, asyncHandler(async (request, response) => { const input = z.object({ holdToken: z.string().min(20) }).parse(request.body); await bookingService.releaseHold(pathParam(request.params.id), input.holdToken); response.status(204).send(); }));
router.post("/bookings", requireAuth, requireCsrf, asyncHandler(async (request, response) => { const input = bookingSchema.parse(request.body); response.status(201).json(await bookingService.createBooking(request.auth!.id, input)); }));
router.get("/bookings/mine", requireAuth, asyncHandler(async (request, response) => { response.json({ bookings: await bookingService.listMyBookings(request.auth!.id) }); }));

export { router as bookingRouter };

function pathParam(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }
