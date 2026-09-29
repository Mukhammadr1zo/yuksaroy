-- Ichki izoh: jamoa obyekt haqida bir-biriga yozadigan eslatma. Egasiga ko'rinmaydi.
-- authorId da FK yo'q (AuditLog.actorId kabi): hisob anonimlashsa izoh va muallif izi qolsin.
CREATE TABLE "AdminNote" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminNote_entity_entityId_createdAt_idx" ON "AdminNote"("entity", "entityId", "createdAt");
