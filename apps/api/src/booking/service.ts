import { randomBytes } from "node:crypto";
import { BookingStatus, GuideApprovalStatus, GuideVerificationStatus, PackageStatus, Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db.js";
import { AuthError } from "../auth/service.js";
import { hashToken } from "../auth/crypto.js";
import { calculatePrice } from "./pricing.js";
import { rankGuide } from "./ranking.js";
import { overlapPredicate, validateDateRange, validateLanguages, validateTourists } from "./validation.js";
import { NotificationType } from "@prisma/client";
import { notificationService } from "../notification/service.js";

const activeBookingStatuses = [BookingStatus.CONFIRMED, BookingStatus.COMPLETED];
const selectionInclude = { destination: { include: { attractions: true } }, images: { orderBy: { sortOrder: "asc" as const } }, attractions: { include: { attraction: true }, orderBy: { sortOrder: "asc" as const } }, inclusions: { orderBy: { sortOrder: "asc" as const } }, exclusions: { orderBy: { sortOrder: "asc" as const } }, cancellationPolicy: true };

export type DiscoveryInput = { destinationSlug: string; packageId: string; from: string; to: string; tourists12Plus: number; languageIds: string[] };
export type HoldInput = DiscoveryInput & { guideId: string };
export type CreateBookingInput = HoldInput & { holdId: string; holdToken: string };

export class BookingService {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async listDestinations() { return this.db.destination.findMany({ where: { isActive: true, deletedAt: null }, include: { attractions: { where: { isActive: true }, orderBy: { name: "asc" } } }, orderBy: { name: "asc" } }); }

  async listLanguages() { return this.db.language.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true }, orderBy: { name: "asc" } }); }

  async getDestination(slug: string) { const destination = await this.db.destination.findFirst({ where: { slug, isActive: true, deletedAt: null }, include: { attractions: { where: { isActive: true }, orderBy: { name: "asc" } }, packages: { where: { status: PackageStatus.PUBLISHED, deletedAt: null }, include: selectionInclude, orderBy: { name: "asc" } } } }); if (!destination) throw new AuthError("DESTINATION_NOT_FOUND", 404); return destination; }

  async listPackages(destinationSlug: string) { const destination = await this.getDestination(destinationSlug); return destination.packages.map(serializePackage); }

  async discoverGuides(input: DiscoveryInput) {
    const { startDate, endDate } = validateDateRange(input.from, input.to); validateLanguages(input.languageIds); validateTourists(input.tourists12Plus, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    const selection = await this.getPackageSelection(input.destinationSlug, input.packageId);
    validateTourists(input.tourists12Plus, selection.package.capacity, Number.MAX_SAFE_INTEGER);
    const languages = await this.db.language.findMany({ where: { id: { in: input.languageIds }, isActive: true } });
    if (languages.length !== input.languageIds.length) throw new AuthError("LANGUAGE_NOT_FOUND", 422);
    const now = new Date();
    const guides = await this.db.guideProfile.findMany({ where: { isActive: true, approvalStatus: GuideApprovalStatus.APPROVED, verificationStatus: GuideVerificationStatus.VERIFIED, capacity: { gte: input.tourists12Plus }, destinations: { some: { destinationId: selection.destination.id } }, availability: { some: { status: "AVAILABLE", startDate: { lte: startDate }, endDate: { gte: endDate } }, none: { status: "BLOCKED", ...overlapPredicate(startDate, endDate) } }, bookings: { none: { bookingStatus: { in: activeBookingStatuses }, ...overlapPredicate(startDate, endDate) } }, holds: { none: { releasedAt: null, expiresAt: { gt: now }, ...overlapPredicate(startDate, endDate) } } }, include: { user: true, languages: { include: { language: true } }, reviews: { where: { moderationStatus: "APPROVED" }, select: { rating: true } } } });
    const ranked = guides.map((guide) => { const languageMatches = input.languageIds.reduce((score, languageId, index) => score + (guide.languages.some((item) => item.languageId === languageId) ? input.languageIds.length - index : 0), 0); const rating = guide.reviews.length ? guide.reviews.reduce((sum, review) => sum + review.rating, 0) / guide.reviews.length : 0; return { id: guide.id, name: guide.user.displayName, photoUrl: guide.profileImageUrl ?? guide.user.profileImageUrl, experienceYears: guide.experienceYears, languages: guide.languages.map((item) => ({ id: item.language.id, name: item.language.name })), rating: Number(rating.toFixed(2)), reviewCount: guide.reviews.length, verified: guide.verificationStatus === GuideVerificationStatus.VERIFIED, destination: selection.destination.name, basePrice: guide.basePrice.toFixed(2), capacity: guide.capacity, languageMatches, rankScore: rankGuide({ languageMatches, preferenceCount: input.languageIds.length, rating, experienceYears: guide.experienceYears, hasAvailability: true }) }; }).sort((left, right) => right.rankScore - left.rankScore);
    return ranked.map((guide) => ({ id: guide.id, name: guide.name, photoUrl: guide.photoUrl, experienceYears: guide.experienceYears, languages: guide.languages, rating: guide.rating, reviewCount: guide.reviewCount, verified: guide.verified, destination: guide.destination, basePrice: guide.basePrice, capacity: guide.capacity }));
  }

  async createHold(input: HoldInput) {
    const { startDate, endDate } = validateDateRange(input.from, input.to); validateLanguages(input.languageIds);
    return this.db.$transaction(async (tx) => { await this.lock(tx, input.guideId, input.from, input.to); const now = new Date(); await tx.bookingHold.updateMany({ where: { expiresAt: { lte: now }, releasedAt: null }, data: { releasedAt: now } }); const selection = await this.getPackageSelection(input.destinationSlug, input.packageId, tx); await this.assertEligibility(tx, selection, input.guideId, startDate, endDate, input.tourists12Plus, input.languageIds); const token = randomBytes(32).toString("base64url"); const hold = await tx.bookingHold.create({ data: { guideId: input.guideId, packageId: selection.package.id, startDate, endDate, holdTokenHash: hashToken(token), expiresAt: new Date(Date.now() + 10 * 60 * 1000) } }); return { holdId: hold.id, holdToken: token, expiresAt: hold.expiresAt.toISOString(), price: calculatePrice(selection.package.basePrice, selection.package.gstRate, input.tourists12Plus) }; });
  }

  async releaseHold(holdId: string, holdToken: string) { const result = await this.db.bookingHold.updateMany({ where: { id: holdId, holdTokenHash: hashToken(holdToken), releasedAt: null, bookingId: null }, data: { releasedAt: new Date() } }); if (result.count !== 1) throw new AuthError("HOLD_NOT_FOUND", 404); }

  async listMyBookings(userId: string) { const bookings = await this.db.booking.findMany({ where: { touristId: userId }, orderBy: { createdAt: "desc" }, select: { id: true, reference: true, startDate: true, endDate: true, bookingStatus: true, paymentStatus: true, totalAmount: true, currency: true } }); return bookings.map((booking) => ({ ...booking, totalAmount: booking.totalAmount.toFixed(2) })); }

  async createBooking(userId: string, input: CreateBookingInput) {
    const { startDate, endDate } = validateDateRange(input.from, input.to); validateLanguages(input.languageIds);
    const result = await this.db.$transaction(async (tx) => { await this.lock(tx, input.guideId, input.from, input.to); const hold = await tx.bookingHold.findUnique({ where: { id: input.holdId } }); if (!hold || hold.holdTokenHash !== hashToken(input.holdToken) || hold.releasedAt || hold.bookingId || hold.expiresAt <= new Date() || hold.guideId !== input.guideId || hold.packageId !== input.packageId || hold.startDate.getTime() !== startDate.getTime() || hold.endDate.getTime() !== endDate.getTime()) throw new AuthError("HOLD_EXPIRED", 409); const selection = await this.getPackageSelection(input.destinationSlug, input.packageId, tx); await this.assertEligibility(tx, selection, input.guideId, startDate, endDate, input.tourists12Plus, input.languageIds, true); const price = calculatePrice(selection.package.basePrice, selection.package.gstRate, input.tourists12Plus); const booking = await tx.booking.create({ data: { touristId: userId, guideId: input.guideId, packageId: selection.package.id, destinationId: selection.destination.id, startDate, endDate, tourists12Plus: input.tourists12Plus, bookingStatus: BookingStatus.PENDING_PAYMENT, paymentStatus: "CREATED", baseAmount: price.baseAmount, gstAmount: price.gstAmount, totalAmount: price.totalAmount, currency: price.currency, priceSnapshot: price, packageSnapshot: serializePackage(selection.package), languagePreferences: { create: input.languageIds.map((languageId, sortOrder) => ({ languageId, sortOrder })) }, payments: { create: { provider: "razorpay", amount: price.totalAmount, currency: price.currency, status: "CREATED", idempotencyKey: randomBytes(24).toString("hex") } } }, include: { languagePreferences: { include: { language: true }, orderBy: { sortOrder: "asc" } }, payments: true } }); await tx.bookingHold.update({ where: { id: hold.id }, data: { bookingId: booking.id } }); return { bookingId: booking.id, reference: booking.reference, status: booking.bookingStatus, paymentStatus: booking.paymentStatus, price, languages: booking.languagePreferences.map((item) => item.language.name) }; });
    void notificationService.enqueue({ userId, type: NotificationType.BOOKING_CREATED, subject: `Booking ${result.reference} created`, body: "Your booking is ready for secure payment. Your guide hold remains active while you complete checkout." });
    return result;
  }

  private async getPackageSelection(destinationSlug: string, packageId: string, client: PrismaClient | Prisma.TransactionClient = this.db) { const destination = await client.destination.findFirst({ where: { slug: destinationSlug, isActive: true, deletedAt: null } }); if (!destination) throw new AuthError("DESTINATION_NOT_FOUND", 404); const packageRecord = await client.tourPackage.findFirst({ where: { id: packageId, destinationId: destination.id, status: PackageStatus.PUBLISHED, deletedAt: null }, include: selectionInclude }); if (!packageRecord) throw new AuthError("PACKAGE_NOT_FOUND", 404); return { destination, package: packageRecord }; }

  private async assertEligibility(client: PrismaClient | Prisma.TransactionClient, selection: Awaited<ReturnType<BookingService["getPackageSelection"]>>, guideId: string, startDate: Date, endDate: Date, tourists: number, languageIds: string[], ignoreHold = false) { const guide = await client.guideProfile.findFirst({ where: { id: guideId, isActive: true, approvalStatus: GuideApprovalStatus.APPROVED, verificationStatus: GuideVerificationStatus.VERIFIED, capacity: { gte: tourists }, destinations: { some: { destinationId: selection.destination.id } }, languages: { some: { languageId: { in: languageIds } } }, availability: { some: { status: "AVAILABLE", startDate: { lte: startDate }, endDate: { gte: endDate } }, none: { status: "BLOCKED", ...overlapPredicate(startDate, endDate) } }, bookings: { none: { bookingStatus: { in: activeBookingStatuses }, ...overlapPredicate(startDate, endDate) } }, ...(ignoreHold ? {} : { holds: { none: { releasedAt: null, expiresAt: { gt: new Date() }, ...overlapPredicate(startDate, endDate) } } }) }, select: { id: true, capacity: true } }); if (!guide) throw new AuthError("GUIDE_UNAVAILABLE", 409); validateTourists(tourists, selection.package.capacity, guide.capacity); }

  private async lock(tx: Prisma.TransactionClient, guideId: string, from: string, to: string) { await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${guideId}:${from}:${to}`}, 0))`; }
}

function serializePackage(packageRecord: { id: string; slug: string; name: string; description: string; durationDays: number; capacity: number; basePrice: Prisma.Decimal; gstRate: Prisma.Decimal; currency: string; images: Array<{ url: string; altText: string | null }>; attractions: Array<{ attraction: { id: string; name: string; description: string | null } }>; inclusions: Array<{ item: string }>; exclusions: Array<{ item: string }>; cancellationPolicy: { name: string; description: string; freeCancellationHours: number } | null }) { return { id: packageRecord.id, slug: packageRecord.slug, name: packageRecord.name, description: packageRecord.description, durationDays: packageRecord.durationDays, capacity: packageRecord.capacity, basePrice: packageRecord.basePrice.toFixed(2), gstRate: packageRecord.gstRate.toFixed(2), currency: packageRecord.currency, images: packageRecord.images, attractions: packageRecord.attractions.map((item) => item.attraction), inclusions: packageRecord.inclusions.map((item) => item.item), exclusions: packageRecord.exclusions.map((item) => item.item), cancellationPolicy: packageRecord.cancellationPolicy }; }

export const bookingService = new BookingService();
