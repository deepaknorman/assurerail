-- CreateTable
CREATE TABLE "OpsFinding" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "checkKey" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "scopeType" TEXT NOT NULL,
    "scopeRef" TEXT,
    "summary" TEXT NOT NULL,
    "observed" JSONB,
    "expected" JSONB,
    "seenCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "OpsFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpsControl" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "agentMode" TEXT NOT NULL DEFAULT 'observe',
    "killSwitch" BOOLEAN NOT NULL DEFAULT false,
    "lastSweepAt" TIMESTAMP(3),
    "lastFindingCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpsControl_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OpsFinding_fingerprint_key" ON "OpsFinding"("fingerprint");

-- CreateIndex
CREATE INDEX "OpsFinding_status_idx" ON "OpsFinding"("status");

-- CreateIndex
CREATE INDEX "OpsFinding_checkKey_idx" ON "OpsFinding"("checkKey");

