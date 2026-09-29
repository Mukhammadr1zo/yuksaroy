-- Jamoa vazifasi: navbatdagi ish jamoadoshga biriktiriladi. Bir obyektga bitta qator (unique),
-- tarix auditda. FK yo'q (AuditLog.actorId kabi): hisob anonimlashsa vazifa izi qolsin.
-- CreateTable
CREATE TABLE "AdminTask" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "note" TEXT,
    "dueAt" TIMESTAMPTZ(3),
    "doneAt" TIMESTAMPTZ(3),
    "doneReason" TEXT,
    "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminTask_assigneeId_doneAt_dueAt_idx" ON "AdminTask"("assigneeId", "doneAt", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminTask_entity_entityId_key" ON "AdminTask"("entity", "entityId");
