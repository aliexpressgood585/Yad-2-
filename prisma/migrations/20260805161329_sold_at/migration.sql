-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "soldAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Listing_categoryId_soldAt_idx" ON "Listing"("categoryId", "soldAt");
