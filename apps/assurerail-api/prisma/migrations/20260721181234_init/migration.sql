-- CreateTable
CREATE TABLE "VenueUser" (
    "id" TEXT NOT NULL,
    "firebaseUid" TEXT,
    "did" TEXT,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "role" TEXT NOT NULL DEFAULT 'INVESTOR',
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "allowlisted" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenueUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "ip" TEXT,

    CONSTRAINT "VenueSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "tapeHash" TEXT NOT NULL,
    "manifestHash" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "serials" JSONB NOT NULL,
    "t1Aggregates" JSONB NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'ISSUED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteHolding" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "holderDid" TEXT NOT NULL,
    "units" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteHolding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MintLog" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "tapeHash" TEXT NOT NULL,
    "kAnonPassed" BOOLEAN NOT NULL,
    "kAnonDetail" JSONB NOT NULL,
    "lockRef" TEXT NOT NULL,
    "htsTxRef" TEXT,
    "actor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MintLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveillanceMirror" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "verdict" JSONB NOT NULL,
    "anchorRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveillanceMirror_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dvp" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "sellerDid" TEXT NOT NULL,
    "buyerDid" TEXT NOT NULL,
    "units" TEXT NOT NULL,
    "settlementMinor" TEXT NOT NULL,
    "settlementToken" TEXT NOT NULL,
    "settlementRef" TEXT NOT NULL,
    "anchorRef" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dvp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreakGlass" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "regulatorDid" TEXT NOT NULL,
    "lawfulPurpose" TEXT NOT NULL,
    "anchorRef" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BreakGlass_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VenueUser_firebaseUid_key" ON "VenueUser"("firebaseUid");

-- CreateIndex
CREATE UNIQUE INDEX "VenueUser_email_key" ON "VenueUser"("email");

-- CreateIndex
CREATE INDEX "VenueUser_did_idx" ON "VenueUser"("did");

-- CreateIndex
CREATE INDEX "VenueSession_userId_idx" ON "VenueSession"("userId");

-- CreateIndex
CREATE INDEX "Note_poolId_idx" ON "Note"("poolId");

-- CreateIndex
CREATE INDEX "NoteHolding_noteId_idx" ON "NoteHolding"("noteId");

-- CreateIndex
CREATE UNIQUE INDEX "NoteHolding_noteId_holderDid_key" ON "NoteHolding"("noteId", "holderDid");

-- CreateIndex
CREATE INDEX "MintLog_poolId_idx" ON "MintLog"("poolId");

-- CreateIndex
CREATE INDEX "SurveillanceMirror_noteId_idx" ON "SurveillanceMirror"("noteId");

-- CreateIndex
CREATE UNIQUE INDEX "SurveillanceMirror_noteId_period_key" ON "SurveillanceMirror"("noteId", "period");

-- CreateIndex
CREATE INDEX "Dvp_noteId_idx" ON "Dvp"("noteId");

-- CreateIndex
CREATE INDEX "BreakGlass_noteId_idx" ON "BreakGlass"("noteId");

-- AddForeignKey
ALTER TABLE "VenueSession" ADD CONSTRAINT "VenueSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "VenueUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
