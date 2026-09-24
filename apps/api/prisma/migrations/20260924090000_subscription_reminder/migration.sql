-- Obuna tugashi eslatmasi bir marta ketsin: yuborilgani shu maydon bilan belgilanadi.
-- Ixtiyoriy ustun: eski qatorlar bo'sh qoladi va birinchi siklda oynaga tushganlari eslatiladi.
ALTER TABLE "Subscription" ADD COLUMN "remindedAt" TIMESTAMPTZ(3);
