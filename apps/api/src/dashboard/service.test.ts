import { describe, expect, it, vi } from "vitest";
import { DashboardService } from "./service.js";

describe("dashboard authorization and rules", () => {
  it("does not return a booking that is not owned by the tourist", async () => {
    const db = { booking: { findFirst: vi.fn().mockResolvedValue(null) } };
    await expect(new DashboardService(db as never).touristBooking("tourist-a", "booking-b")).rejects.toMatchObject({ code: "BOOKING_NOT_FOUND", status: 404 });
    expect(db.booking.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ touristId: "tourist-a" }) }));
  });

  it("only allows reviews for completed bookings without an existing review", async () => {
    const db = { booking: { findUnique: vi.fn().mockResolvedValue({ touristId: "tourist-a", guideId: "guide-a", bookingStatus: "CONFIRMED", review: null }) } };
    await expect(new DashboardService(db as never).submitReview("tourist-a", "booking-a", 5, undefined, "A good trip")).rejects.toMatchObject({ code: "REVIEW_NOT_ELIGIBLE" });
  });

  it("rejects guide availability that overlaps a confirmed booking", async () => {
    const db = { guideProfile: { findUnique: vi.fn().mockResolvedValue({ id: "guide-a" }) }, booking: { findFirst: vi.fn().mockResolvedValue({ id: "booking-a" }) } };
    await expect(new DashboardService(db as never).updateGuideAvailability("user-a", { startDate: new Date("2030-01-01"), endDate: new Date("2030-01-03"), status: "BLOCKED" })).rejects.toMatchObject({ code: "AVAILABILITY_CONFLICT" });
  });
});
