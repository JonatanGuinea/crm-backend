-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('invoice_overdue', 'invoice_paid', 'quote_expiring', 'quote_approved', 'quote_rejected', 'project_deadline', 'member_joined');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "refId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_organizationId_read_idx" ON "Notification"("userId", "organizationId", "read");

-- CreateIndex
CREATE INDEX "Notification_userId_organizationId_createdAt_idx" ON "Notification"("userId", "organizationId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Notification_type_userId_organizationId_refId_key" ON "Notification"("type", "userId", "organizationId", "refId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
