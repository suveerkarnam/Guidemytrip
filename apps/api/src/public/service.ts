import { PrismaClient, ReviewModerationStatus } from "@prisma/client";
import { prisma as defaultPrisma } from "../db.js";
import { NotificationType } from "@prisma/client";
import { notificationService } from "../notification/service.js";

export class PublicService {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async approvedReviews() { return this.db.review.findMany({ where: { moderationStatus: ReviewModerationStatus.APPROVED }, include: { tourist: { select: { displayName: true } }, guide: { include: { user: { select: { displayName: true } } } }, booking: { include: { destination: { select: { name: true } } } } }, orderBy: { createdAt: "desc" }, take: 50 }); }

  async submitContact(input: { userId?: string; name: string; email: string; mobile?: string; subject: string; message: string }) {
    const contact = await this.db.contactMessage.create({ data: input });
    if (input.userId) await notificationService.enqueue({ userId: input.userId, type: NotificationType.CONTACT_ACKNOWLEDGEMENT, subject: "We received your message", body: "Thank you for contacting GuideMyTrip. Our team will review your message and respond when appropriate." });
    return { id: contact.id, status: contact.status };
  }
}

export const publicService = new PublicService();
