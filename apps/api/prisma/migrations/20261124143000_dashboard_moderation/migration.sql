CREATE TYPE "ReviewModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "ContactMessageStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

ALTER TABLE "Review"
ADD COLUMN "moderationStatus" "ReviewModerationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "moderatedBy" UUID,
ADD COLUMN "moderationReason" TEXT;

ALTER TABLE "ContactMessage"
ADD COLUMN "status" "ContactMessageStatus" NOT NULL DEFAULT 'NEW',
ADD COLUMN "adminNotes" TEXT,
ADD COLUMN "handledBy" UUID;

ALTER TABLE "Review"
ADD CONSTRAINT "Review_moderatedBy_fkey"
FOREIGN KEY ("moderatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContactMessage"
ADD CONSTRAINT "ContactMessage_handledBy_fkey"
FOREIGN KEY ("handledBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Review_moderationStatus_createdAt_idx" ON "Review"("moderationStatus", "createdAt");
CREATE INDEX "ContactMessage_status_createdAt_idx" ON "ContactMessage"("status", "createdAt");
