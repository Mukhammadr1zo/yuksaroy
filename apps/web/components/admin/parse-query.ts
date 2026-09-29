/**
 * Buyruq paletidagi raqam prefikslari: PAY-1042, SR-12, YS-41, UR-7 yoki telefon.
 * Bu tahlil mijozda, chunki manzil panel ekranlariniki (API panel yo'llarini bilmaydi)
 * va serverga so'rov yubormasdan bir sakrashda ochilishi kerak.
 *
 * Jadval tartibi muhim: telefon qoidasi eng oxirida, aks holda "1042" ham telefon deb o'qilardi.
 * Erkin matn (tashkilot nomi, ism) null qaytaradi va serverdagi /admin/search ga ketadi.
 */
const RULES: [RegExp, (m: RegExpMatchArray) => string][] = [
  // Obuna reyestri raqam bo'yicha contains bilan topadi
  [/^PAY-?(\d+)$/i, (m) => `/admin/subscriptions?q=PAY-${m[1]}`],
  // Yuk (CR) va xizmat (SR) so'rovlari bitta doskada
  [/^(SR|CR)-?(\d+)$/i, (m) => `/admin/market?q=${m[1]!.toUpperCase()}-${m[2]}`],
  // Buyurtma raqami to'rt xonali: YS-0041, odam "YS-41" deb yozadi
  [/^YS-?(\d+)$/i, (m) => `/admin/orders?q=YS-${m[1]!.padStart(4, '0')}`],
  [/^UR-?(\d+)$/i, (m) => `/admin/urgent?q=UR-${m[1]}`],
  // Telefon: faqat raqamlar ketadi, foydalanuvchilar ro'yxati contains bilan topadi
  [/^\+?[\d\s()-]{7,}$/, (m) => `/admin/users?q=${m[0].replace(/\D/g, '')}`],
];

export function parseAdminQuery(q: string): { href: string } | null {
  const s = q.trim();
  for (const [re, to] of RULES) {
    const m = s.match(re);
    if (m) return { href: to(m) };
  }
  return null;
}
