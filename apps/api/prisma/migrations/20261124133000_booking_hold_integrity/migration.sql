ALTER TABLE "BookingLanguage" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "BookingLanguage_bookingId_sortOrder_idx"
ON "BookingLanguage"("bookingId", "sortOrder");

ALTER TABLE "BookingHold" ADD COLUMN "packageId" UUID;

UPDATE "BookingHold" AS hold
SET "packageId" = booking."packageId"
FROM "Booking" AS booking
WHERE hold."bookingId" = booking."id";

-- If an existing installation contains an unassociated legacy hold, backfill
-- or expire it before deploying this migration. It must not be guessed.
ALTER TABLE "BookingHold" ALTER COLUMN "packageId" SET NOT NULL;

ALTER TABLE "BookingHold"
ADD CONSTRAINT "BookingHold_packageId_fkey"
FOREIGN KEY ("packageId") REFERENCES "TourPackage"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "BookingHold_packageId_idx" ON "BookingHold"("packageId");
