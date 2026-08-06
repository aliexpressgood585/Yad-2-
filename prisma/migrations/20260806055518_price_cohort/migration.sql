-- DropIndex
DROP INDEX "Listing_categoryId_status_comparableBand_price_idx";

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "cohortKey" TEXT,
ADD COLUMN     "cohortKeyBroad" TEXT,
ADD COLUMN     "comparableBand2" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Listing_categoryId_status_cohortKey_comparableBand_price_idx" ON "Listing"("categoryId", "status", "cohortKey", "comparableBand", "price");

-- CreateIndex
CREATE INDEX "Listing_categoryId_status_cohortKeyBroad_comparableBand_pri_idx" ON "Listing"("categoryId", "status", "cohortKeyBroad", "comparableBand", "price");
