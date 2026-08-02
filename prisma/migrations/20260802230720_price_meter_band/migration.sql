-- DropIndex
DROP INDEX "Listing_city_trgm_idx";

-- DropIndex
DROP INDEX "Listing_searchText_trgm_idx";

-- DropIndex
DROP INDEX "Listing_title_trgm_idx";

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "comparableBand" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Listing_categoryId_status_comparableBand_price_idx" ON "Listing"("categoryId", "status", "comparableBand", "price");
