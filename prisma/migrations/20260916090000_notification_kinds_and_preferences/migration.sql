-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationKind" ADD VALUE 'TASK_ASSIGNED';
ALTER TYPE "NotificationKind" ADD VALUE 'TASK_COMPLETED';
ALTER TYPE "NotificationKind" ADD VALUE 'CASE_ASSIGNED';
ALTER TYPE "NotificationKind" ADD VALUE 'HEARING_SCHEDULED';
ALTER TYPE "NotificationKind" ADD VALUE 'DOCUMENT_UPLOADED';
ALTER TYPE "NotificationKind" ADD VALUE 'CONFLICT_WAIVED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mutedNotificationKinds" "NotificationKind"[] DEFAULT ARRAY[]::"NotificationKind"[];

