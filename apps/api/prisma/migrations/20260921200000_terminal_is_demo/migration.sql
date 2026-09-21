-- Namuna terminal: sahifada "Namuna" belgisi chiqadi, telefon berilmaydi,
-- admin panelidagi "Namuna ma'lumotlarni o'chirish" tugmasi shu ustun bo'yicha topadi.
ALTER TABLE "Terminal" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
