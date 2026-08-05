-- CreateEnum
CREATE TYPE "JobState" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "NotificationJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "NotificationType" NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "state" "JobState" NOT NULL DEFAULT 'PENDING',
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationJob_dedupeKey_key" ON "NotificationJob"("dedupeKey");

-- CreateIndex
CREATE INDEX "NotificationJob_state_runAfter_idx" ON "NotificationJob"("state", "runAfter");

-- CreateIndex
CREATE INDEX "NotificationJob_userId_state_idx" ON "NotificationJob"("userId", "state");

-- AddForeignKey
ALTER TABLE "NotificationJob" ADD CONSTRAINT "NotificationJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
