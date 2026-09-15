-- CreateEnum
CREATE TYPE "TimeActivity" AS ENUM ('RESEARCH', 'DRAFTING', 'HEARING', 'CLIENT_MEETING', 'CORRESPONDENCE', 'REVIEW', 'TRAVEL', 'ADMIN', 'OTHER');

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caseId" TEXT,
    "workDate" DATE NOT NULL,
    "minutes" INTEGER NOT NULL,
    "activity" "TimeActivity" NOT NULL DEFAULT 'OTHER',
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunningTimer" (
    "userId" TEXT NOT NULL,
    "caseId" TEXT,
    "activity" "TimeActivity" NOT NULL DEFAULT 'OTHER',
    "description" TEXT NOT NULL DEFAULT '',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunningTimer_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "TimeEntry_userId_workDate_idx" ON "TimeEntry"("userId", "workDate");

-- CreateIndex
CREATE INDEX "TimeEntry_caseId_workDate_idx" ON "TimeEntry"("caseId", "workDate");

-- CreateIndex
CREATE INDEX "TimeEntry_workDate_idx" ON "TimeEntry"("workDate");

-- CreateIndex
CREATE INDEX "RunningTimer_caseId_idx" ON "RunningTimer"("caseId");

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunningTimer" ADD CONSTRAINT "RunningTimer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunningTimer" ADD CONSTRAINT "RunningTimer_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

