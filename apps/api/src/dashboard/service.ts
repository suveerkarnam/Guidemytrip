import { BookingStatus, ContactMessageStatus, GuideApprovalStatus, GuideVerificationStatus, PackageStatus, PrismaClient, ReviewModerationStatus, RoleCode } from "@prisma/client";
import { prisma as defaultPrisma } from "../db.js";
import { AuthError } from "../auth/service.js";

const bookingInclude = { tourist: { select: { id: true, displayName: true, email: true, phone: true } }, destination: true, package: true, guide: { include: { user: true } }, languagePreferences: { include: { language: true }, orderBy: { sortOrder: "asc" as const } }, payments: { orderBy: { createdAt: "desc" as const } }, refunds: { orderBy: { createdAt: "desc" as const } }, cancellations: { orderBy: { createdAt: "desc" as const } }, review: true };

export class DashboardService {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async touristBookings(userId: string, tab: "upcoming" | "past" | "cancelled") {
    const today = new Date(new Date().toISOString().slice(0, 10));
    const where = tab === "upcoming" ? { touristId: userId, bookingStatus: { in: [BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED] }, startDate: { gte: today } } : tab === "past" ? { touristId: userId, bookingStatus: BookingStatus.COMPLETED } : { touristId: userId, bookingStatus: { in: [BookingStatus.CANCELLED, BookingStatus.EXPIRED] } };
    return this.db.booking.findMany({ where, include: bookingInclude, orderBy: { startDate: tab === "past" ? "desc" : "asc" } });
  }

  async touristBooking(userId: string, bookingId: string) { return this.findOwnedBooking(userId, bookingId, "touristId"); }

  async submitReview(userId: string, bookingId: string, rating: number, title: string | undefined, body: string) {
    const booking = await this.db.booking.findUnique({ where: { id: bookingId }, select: { touristId: true, guideId: true, bookingStatus: true, review: true } });
    if (!booking || booking.touristId !== userId) throw new AuthError("BOOKING_NOT_FOUND", 404);
    if (booking.bookingStatus !== BookingStatus.COMPLETED) throw new AuthError("REVIEW_NOT_ELIGIBLE", 409);
    if (booking.review) throw new AuthError("REVIEW_ALREADY_EXISTS", 409);
    return this.db.review.create({ data: { bookingId, touristId: userId, guideId: booking.guideId, rating, title: title?.trim() || undefined, body: body.trim() } });
  }

  async guideDashboard(userId: string) {
    const guide = await this.db.guideProfile.findUnique({ where: { userId }, select: { id: true, experienceYears: true, biography: true, profileImageUrl: true, capacity: true, basePrice: true, verificationStatus: true, approvalStatus: true, isActive: true, languages: { include: { language: true } }, destinations: { include: { destination: true } }, availability: { orderBy: { startDate: "asc" } } } });
    if (!guide) throw new AuthError("GUIDE_PROFILE_NOT_FOUND", 404);
    const bookings = await this.db.booking.findMany({ where: { guideId: guide.id }, include: bookingInclude, orderBy: { startDate: "asc" } });
    return { profile: guide, bookings };
  }

  async updateGuideAvailability(userId: string, input: { startDate: Date; endDate: Date; status: "AVAILABLE" | "BLOCKED"; note?: string }) {
    const guide = await this.db.guideProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!guide) throw new AuthError("GUIDE_PROFILE_NOT_FOUND", 404);
    if (input.endDate < input.startDate) throw new AuthError("INVALID_DATE_RANGE", 422);
    if (input.status === "BLOCKED") {
      const conflict = await this.db.booking.findFirst({ where: { guideId: guide.id, bookingStatus: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] }, startDate: { lt: input.endDate }, endDate: { gt: input.startDate } } });
      if (conflict) throw new AuthError("AVAILABILITY_CONFLICT", 409);
    }
    return this.db.guideAvailability.create({ data: { guideId: guide.id, startDate: input.startDate, endDate: input.endDate, status: input.status, note: input.note } });
  }

  async updateGuideProfile(userId: string, input: { biography?: string; profileImageUrl?: string; experienceYears?: number; capacity?: number; basePrice?: string }) {
    const guide = await this.db.guideProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!guide) throw new AuthError("GUIDE_PROFILE_NOT_FOUND", 404);
    return this.db.guideProfile.update({ where: { id: guide.id }, data: { biography: input.biography, profileImageUrl: input.profileImageUrl, experienceYears: input.experienceYears, capacity: input.capacity, basePrice: input.basePrice } });
  }

  async adminMetrics() {
    const [tourists, guides, activeGuides, pendingGuides, totalBookings, upcomingBookings, completedBookings, cancelledBookings, revenue, refunds] = await Promise.all([
      this.db.userRole.count({ where: { role: { code: RoleCode.TOURIST } } }), this.db.guideProfile.count(), this.db.guideProfile.count({ where: { isActive: true } }), this.db.guideProfile.count({ where: { approvalStatus: GuideApprovalStatus.PENDING } }), this.db.booking.count(), this.db.booking.count({ where: { bookingStatus: BookingStatus.CONFIRMED, startDate: { gte: new Date() } } }), this.db.booking.count({ where: { bookingStatus: BookingStatus.COMPLETED } }), this.db.booking.count({ where: { bookingStatus: BookingStatus.CANCELLED } }), this.db.payment.aggregate({ _sum: { amount: true }, where: { status: { in: ["CAPTURED", "REFUNDED", "PARTIALLY_REFUNDED"] } } }), this.db.refund.aggregate({ _sum: { amount: true }, where: { status: "PROCESSED" } }),
    ]);
    return { tourists, guides, activeGuides, pendingGuides, totalBookings, upcomingBookings, completedBookings, cancelledBookings, revenue: revenue._sum.amount?.toFixed(2) ?? "0.00", refunds: refunds._sum.amount?.toFixed(2) ?? "0.00" };
  }

  async adminGuides() { return this.db.guideProfile.findMany({ include: { user: true, languages: { include: { language: true } }, destinations: { include: { destination: true } } }, orderBy: { createdAt: "desc" } }); }

  async createGuide(input: { email?: string; phone?: string; displayName: string; biography?: string; profileImageUrl?: string; experienceYears: number; capacity: number; basePrice: string; languageIds: string[]; destinationIds: string[] }) {
    const role = await this.db.role.findUniqueOrThrow({ where: { code: RoleCode.GUIDE } });
    return this.db.user.create({ data: { email: input.email, phone: input.phone, displayName: input.displayName, roles: { create: { roleId: role.id } }, guideProfile: { create: { biography: input.biography, profileImageUrl: input.profileImageUrl, experienceYears: input.experienceYears, capacity: input.capacity, basePrice: input.basePrice, languages: { create: input.languageIds.map((languageId) => ({ languageId })) }, destinations: { create: input.destinationIds.map((destinationId) => ({ destinationId })) } } } }, include: { guideProfile: true } });
  }

  async updateGuideStatus(guideId: string, input: { isActive?: boolean; approvalStatus?: GuideApprovalStatus; verificationStatus?: GuideVerificationStatus }) { const guide = await this.db.guideProfile.update({ where: { id: guideId }, data: input }); await this.db.auditLog.create({ data: { action: "GUIDE_STATUS_UPDATED", entityType: "GuideProfile", entityId: guideId, metadata: input } }); return guide; }

  async adminPackages() { return this.db.tourPackage.findMany({ include: { destination: true, cancellationPolicy: true }, orderBy: { updatedAt: "desc" } }); }

  async adminDestinations() { return this.db.destination.findMany({ include: { attractions: true }, orderBy: { name: "asc" } }); }

  async createDestination(input: { slug: string; name: string; region: string; description: string; imageUrl?: string }) { return this.db.destination.create({ data: input }); }

  async updateDestination(destinationId: string, input: { name?: string; region?: string; description?: string; imageUrl?: string; isActive?: boolean }) { return this.db.destination.update({ where: { id: destinationId }, data: input }); }

  async createPackage(input: { destinationId: string; name: string; slug: string; description: string; durationDays: number; capacity: number; basePrice: string; gstRate: string; status?: PackageStatus }) { return this.db.tourPackage.create({ data: { ...input, status: input.status ?? PackageStatus.DRAFT } }); }

  async updatePackage(packageId: string, input: { name?: string; description?: string; durationDays?: number; capacity?: number; basePrice?: string; gstRate?: string; status?: PackageStatus }) { return this.db.tourPackage.update({ where: { id: packageId }, data: input }); }

  async adminBookings(search?: string, status?: BookingStatus) { return this.db.booking.findMany({ where: { ...(status ? { bookingStatus: status } : {}), ...(search ? { OR: [{ reference: { contains: search, mode: "insensitive" } }, { tourist: { displayName: { contains: search, mode: "insensitive" } } }] } : {}) }, include: bookingInclude, orderBy: { createdAt: "desc" }, take: 100 }); }

  async adminReviews() { return this.db.review.findMany({ include: { booking: true, tourist: true, guide: { include: { user: true } }, moderator: true }, orderBy: { createdAt: "desc" }, take: 100 }); }

  async moderateReview(adminId: string, reviewId: string, status: ReviewModerationStatus, reason?: string) { const review = await this.db.review.update({ where: { id: reviewId }, data: { moderationStatus: status, moderatedBy: adminId, moderationReason: reason } }); await this.db.auditLog.create({ data: { userId: adminId, action: `REVIEW_${status}`, entityType: "Review", entityId: reviewId, metadata: { reason } } }); return review; }

  async adminContacts() { return this.db.contactMessage.findMany({ include: { user: true, handler: true }, orderBy: { createdAt: "desc" }, take: 100 }); }

  async updateContact(adminId: string, contactId: string, status: ContactMessageStatus, adminNotes?: string) { const contact = await this.db.contactMessage.update({ where: { id: contactId }, data: { status, adminNotes, handledBy: adminId } }); await this.db.auditLog.create({ data: { userId: adminId, action: "CONTACT_STATUS_UPDATED", entityType: "ContactMessage", entityId: contactId, metadata: { status } } }); return contact; }

  private async findOwnedBooking(userId: string, bookingId: string, ownerField: "touristId" | "guideId") { const booking = await this.db.booking.findFirst({ where: { id: bookingId, [ownerField]: userId }, include: bookingInclude }); if (!booking) throw new AuthError("BOOKING_NOT_FOUND", 404); return booking; }
}

export const dashboardService = new DashboardService();
