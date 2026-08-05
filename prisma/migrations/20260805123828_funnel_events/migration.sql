-- CreateEnum
CREATE TYPE "FunnelStep" AS ENUM ('SEARCH', 'VIEW', 'REVEAL', 'MESSAGE', 'REPLY');

-- CreateTable
CREATE TABLE "FunnelEvent" (
    "id" TEXT NOT NULL,
    "step" "FunnelStep" NOT NULL,
    "day" DATE NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "listingId" TEXT,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunnelEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FunnelEvent_day_step_idx" ON "FunnelEvent"("day", "step");

-- CreateIndex
CREATE INDEX "FunnelEvent_step_sessionId_listingId_idx" ON "FunnelEvent"("step", "sessionId", "listingId");
