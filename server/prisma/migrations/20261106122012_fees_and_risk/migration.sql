/*
  Warnings:

  - A unique constraint covering the columns `[receiptNo]` on the table `FeeLedgerEntry` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "LinkStatus" AS ENUM ('OPEN', 'PAID', 'CANCELLED');

-- AlterTable
ALTER TABLE "FeeLedgerEntry" ADD COLUMN     "actorId" TEXT,
ADD COLUMN     "dueDate" DATE,
ADD COLUMN     "method" TEXT,
ADD COLUMN     "receiptNo" TEXT,
ADD COLUMN     "reference" TEXT;

-- AlterTable
ALTER TABLE "MentorTask" ADD COLUMN     "doneAt" TIMESTAMP(3),
ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "RiskFlag" ADD COLUMN     "dismissedById" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "PaymentLink" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "status" "LinkStatus" NOT NULL DEFAULT 'OPEN',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "PaymentLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentLink_token_key" ON "PaymentLink"("token");

-- CreateIndex
CREATE INDEX "PaymentLink_studentId_idx" ON "PaymentLink"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "FeeLedgerEntry_receiptNo_key" ON "FeeLedgerEntry"("receiptNo");

-- CreateIndex
CREATE INDEX "RiskFlag_status_idx" ON "RiskFlag"("status");

-- AddForeignKey
ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE SEQUENCE IF NOT EXISTS receipt_seq START 1001;