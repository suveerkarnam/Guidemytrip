import { NotificationChannel, NotificationStatus, NotificationType, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db.js";
import { emailProvider, smsNotificationProvider, whatsAppProvider } from "./providers.js";

const MAX_ATTEMPTS = 3;

export class NotificationService {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async enqueue(input: { userId: string; type: NotificationType; subject: string; body: string; channel?: NotificationChannel }) {
    const notification = await this.db.notification.create({ data: { userId: input.userId, type: input.type, channel: input.channel ?? NotificationChannel.EMAIL, subject: input.subject, body: input.body } });
    void this.deliver(notification.id);
    return notification;
  }

  async deliver(notificationId: string) {
    const notification = await this.db.notification.findUnique({ where: { id: notificationId }, include: { user: { select: { email: true, phone: true } } } });
    if (!notification || notification.status === NotificationStatus.SENT || notification.attemptCount >= MAX_ATTEMPTS) return notification;
    try {
      if (notification.channel === NotificationChannel.EMAIL && notification.user.email) {
        const sent = await emailProvider.send({ to: notification.user.email, subject: notification.subject, body: notification.body });
        return this.db.notification.update({ where: { id: notificationId }, data: { status: NotificationStatus.SENT, sentAt: new Date(), lastAttemptAt: new Date(), attemptCount: { increment: 1 }, providerMessageId: sent.providerMessageId, errorMessage: null } });
      }
      if (notification.channel === NotificationChannel.SMS && notification.user.phone) {
        const sent = await smsNotificationProvider.send({ to: notification.user.phone, body: notification.body });
        return this.db.notification.update({ where: { id: notificationId }, data: { status: NotificationStatus.SENT, sentAt: new Date(), lastAttemptAt: new Date(), attemptCount: { increment: 1 }, providerMessageId: sent.providerMessageId, errorMessage: null } });
      }
      if (notification.channel === NotificationChannel.IN_APP) return this.db.notification.update({ where: { id: notificationId }, data: { status: NotificationStatus.SENT, sentAt: new Date(), lastAttemptAt: new Date(), attemptCount: { increment: 1 }, errorMessage: null } });
      if (notification.channel === NotificationChannel.WHATSAPP && notification.user.phone) {
        const sent = await whatsAppProvider.send({ to: notification.user.phone, body: notification.body });
        return this.db.notification.update({ where: { id: notificationId }, data: { status: NotificationStatus.SENT, sentAt: new Date(), lastAttemptAt: new Date(), attemptCount: { increment: 1 }, providerMessageId: sent.providerMessageId, errorMessage: null } });
      }
      return this.db.notification.update({ where: { id: notificationId }, data: { status: NotificationStatus.FAILED, lastAttemptAt: new Date(), attemptCount: { increment: 1 }, errorMessage: "Recipient has no configured email address" } });
    } catch (error) {
      return this.db.notification.update({ where: { id: notificationId }, data: { status: NotificationStatus.FAILED, lastAttemptAt: new Date(), attemptCount: { increment: 1 }, errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Provider delivery failed" } });
    }
  }

  async retry(notificationId: string) { return this.deliver(notificationId); }
  async listForUser(userId: string) { return this.db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 }); }
}

export const notificationService = new NotificationService();
