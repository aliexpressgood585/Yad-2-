-- CreateEnum
CREATE TYPE "AnalyticsEventType" AS ENUM ('SEARCH', 'LISTING_VIEW', 'PHONE_REVEAL', 'CONTACT');

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "type" "AnalyticsEventType" NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "listingId" TEXT,
    "categoryId" TEXT,
    "query" TEXT,
    "resultCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsEvent_type_createdAt_idx" ON "AnalyticsEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_sessionId_createdAt_idx" ON "AnalyticsEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_listingId_type_createdAt_idx" ON "AnalyticsEvent"("listingId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");
