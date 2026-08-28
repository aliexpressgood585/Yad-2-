-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "feedId" TEXT;

-- CreateIndex
CREATE INDEX "Listing_feedId_idx" ON "Listing"("feedId");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "ListingFeed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

