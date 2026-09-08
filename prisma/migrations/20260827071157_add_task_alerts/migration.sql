-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReminderOffset" ADD VALUE 'DAY_30';
ALTER TYPE "ReminderOffset" ADD VALUE 'DAY_14';
ALTER TYPE "ReminderOffset" ADD VALUE 'OVERDUE';

-- CreateTable
CREATE TABLE "TaskAlert" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "offset" "ReminderOffset" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskAlert_taskId_offset_key" ON "TaskAlert"("taskId", "offset");

-- AddForeignKey
ALTER TABLE "TaskAlert" ADD CONSTRAINT "TaskAlert_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
