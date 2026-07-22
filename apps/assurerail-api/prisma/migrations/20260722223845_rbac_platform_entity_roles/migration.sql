-- AlterTable
ALTER TABLE "VenueUser" ADD COLUMN     "entityDid" TEXT,
ADD COLUMN     "entityRole" TEXT,
ADD COLUMN     "platformRole" TEXT;

-- CreateIndex
CREATE INDEX "VenueUser_entityDid_idx" ON "VenueUser"("entityDid");

