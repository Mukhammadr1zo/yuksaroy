// /tg ostidagi noma'lum yo'l: Next o'zi [locale] 404 iga (sayt ko'rinishi) tushirardi; notFound() shu segmentdagi
// not-found.tsx ni chizadi, foydalanuvchi ilova ichida qoladi.
import { notFound } from 'next/navigation';

export default function TgMissing() {
  notFound();
}
