-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "sentByEmail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sentByWhatsapp" BOOLEAN NOT NULL DEFAULT false;
