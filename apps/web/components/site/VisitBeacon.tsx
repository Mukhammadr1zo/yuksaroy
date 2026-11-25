'use client';
/**
 * Tashrif mayog'i. Rozilik berilgach brauzer HAR sahifada serverga sahifa yo'lini va
 * qayerdan kelganini yuboradi (`first` esa eski kunlik sanoq belgisi).
 *
 * Server bundan nima qiladi: kunlik sanoqqa faqat `first` bo'lganda bitta son qo'shadi
 * (davlat + viloyat), sahifa yo'li va qayerdan kelgani bazaga yozilmaydi: ular faqat
 * platforma administratorining Telegram xabariga boradi. Rozilik bo'lmasa hech narsa
 * ketmaydi, shuning uchun rad etgan odam na sanoqda, na xabarda bo'ladi.
 *
 * Nega `first` brauzerda hal qilinadi: bitta mobil operator minglab abonentni bitta
 * ommaviy IP ortiga qo'yadi, serverda IP bo'yicha ajratish haqiqiy odamlarni bir kishiga
 * birlashtirib yuborardi. Saqlanadigan yagona narsa - sana (ys-visit), yangi kalit yo'q.
 *
 * Kabinet, admin paneli va Telegram ilovasi yuborilmaydi: ular egasining o'z ishi,
 * tashrif emas. Yo'l tili prefiksisiz olinadi, aks holda /ru/dashboard bu ro'yxatga
 * tushmay, egasining har kuni tashrif bo'lib sanalardi.
 */
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { usePathname } from '@/i18n/navigation';
import { PRIVATE_PATH, getConsent, getConsentServer, subscribeConsent } from '@/lib/consent';

const KEY = 'ys-visit';
// Oldingi ichki sahifa: yumshoq o'tishda document.referrer o'zgarmaydi, shuning uchun o'zimiz yuritamiz
let prevPath: string | null = null;

export function VisitBeacon() {
  const path = usePathname();
  const consent = useSyncExternalStore(subscribeConsent, getConsent, getConsentServer);
  const sent = useRef<string | null>(null);

  useEffect(() => {
    // Rozilik berilmaguncha hech narsa yuborilmaydi va ys-visit yozilmaydi: rozi bo'lmagan
    // odam tashrif sanog'iga ham, xabarga ham umuman tushmaydi, bu ataylab.
    if (consent !== 'yes' || PRIVATE_PATH.test(path)) return;
    // Ikki marta chizilishda (dev) yoki rozilik almashganda bir sahifa ikki marta ketmasin
    if (sent.current === path) return;
    sent.current = path;
    const today = new Date().toISOString().slice(0, 10);
    let first = false;
    try {
      if (localStorage.getItem(KEY) !== today) { localStorage.setItem(KEY, today); first = true; }
    } catch {
      // Saqlash yo'q (maxfiy oyna): kunlik sanoqqa tegmaymiz, aks holda har sahifa
      // ochilishi yangi tashrif bo'lib sanalardi. Yo'l baribir yuboriladi.
    }
    const referrer = prevPath === null ? document.referrer : location.origin + prevPath;
    prevPath = path;
    // Javob kutilmaydi: sahifa chizilishiga ta'sir qilmasin
    void fetch('/api/v1/events/visit', {
      method: 'POST', keepalive: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path, referrer: referrer || undefined, first }),
    }).catch(() => {});
  }, [path, consent]);

  return null;
}
