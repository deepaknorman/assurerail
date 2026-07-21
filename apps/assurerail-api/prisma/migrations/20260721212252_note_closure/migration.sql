-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "burnTxRef" TEXT,
ADD COLUMN     "closeAnchorRef" TEXT,
ADD COLUMN     "closeReason" TEXT,
ADD COLUMN     "redeemedAt" TIMESTAMP(3);
