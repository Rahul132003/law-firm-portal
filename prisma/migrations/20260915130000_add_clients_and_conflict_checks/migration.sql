-- CreateEnum
CREATE TYPE "ClientKind" AS ENUM ('INDIVIDUAL', 'ORGANISATION');

-- CreateEnum
CREATE TYPE "ConflictOutcome" AS ENUM ('CLEAR', 'WAIVED');

-- AlterTable
ALTER TABLE "Case" ADD COLUMN     "clientId" TEXT;

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "kind" "ClientKind" NOT NULL DEFAULT 'INDIVIDUAL',
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConflictCheck" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "performedById" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "opposingParty" TEXT,
    "adverseMatches" INTEGER NOT NULL,
    "relatedMatches" INTEGER NOT NULL,
    "matches" JSONB NOT NULL,
    "outcome" "ConflictOutcome" NOT NULL,
    "waiverReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConflictCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Client_normalizedName_idx" ON "Client"("normalizedName");

-- CreateIndex
CREATE INDEX "Client_name_idx" ON "Client"("name");

-- CreateIndex
CREATE INDEX "ConflictCheck_caseId_createdAt_idx" ON "ConflictCheck"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "ConflictCheck_outcome_createdAt_idx" ON "ConflictCheck"("outcome", "createdAt");

-- CreateIndex
CREATE INDEX "Case_clientId_idx" ON "Case"("clientId");

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictCheck" ADD CONSTRAINT "ConflictCheck_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictCheck" ADD CONSTRAINT "ConflictCheck_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

