-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "clientSignature" TEXT,
ADD COLUMN     "clientSignedAt" TIMESTAMP(3);
