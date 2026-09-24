-- Foydalanuvchi shikoyati: e'lon, terminal, xizmat sahifasi, bozor so'rovi va buyurtma ustidan.
--
-- Nega yangi jadval, mavjud ContactMessage emas: murojaat ochiq forma (kirmagan odam ham
-- yuboradi) va unda obyekt yo'q; shikoyat esa aniq obyektga tegishli va kirgan odamdan keladi.
--
-- targetTitle va targetHref ataylab nusxa: obyekt o'chsa ham navbatdagi qator o'qiladi va
-- ro'yxatni chizish uchun beshta jadvalga qayta borilmaydi.
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetTitle" TEXT NOT NULL,
    "targetHref" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMPTZ(3),
    "resolveNote" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- Bir odam bir obyektga bir marta. Tekshiruv shu yerda: ilova tomonda "avval bormi" deb
-- so'ralsa ikki barobar yuborishda ikkalasi ham o'tib ketardi.
CREATE UNIQUE INDEX "Report_reporterId_targetKind_targetId_key" ON "Report"("reporterId", "targetKind", "targetId");

-- Moderatsiya ro'yxati (holat bo'yicha, yangisidan eskisiga) va bosh sahifadagi son.
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");

-- User ga tashqi kalit ataylab yo'q: hisob o'chirilsa shikoyat qatori qolishi kerak
-- (ContactMessage.handledById va AuditLog.actorId bilan bir xil qoida).
