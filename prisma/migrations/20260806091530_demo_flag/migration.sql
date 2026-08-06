-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Listing_isDemo_status_deletedAt_idx" ON "Listing"("isDemo", "status", "deletedAt");
