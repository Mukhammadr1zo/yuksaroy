'use client';
/**
 * Tashrif mayog'i: brauzer kuniga bir marta bitta bo'sh so'rov yuboradi.
 *
 * Nega qaror brauzerda: bitta mobil operator minglab abonentni bitta ommaviy IP ortiga
 * qo'yadi, ya'ni serverda IP bo'yicha ajratish haqiqiy odamlarni bir kishiga birlashtirib
 * yuborardi. Bu yerdagi belgi esa shu brauzerniki, ya'ni son haqiqatga yaqin bo'ladi.
 *
 * Saqlanadigan yagona narsa - sana. Hech qanday identifikator yaratilmaydi va
 * serverga sahifa manzili ham yuborilmaydi: unga faqat IP boradi va undan davlat
 * bilan viloyat chiqariladi.
 *
 * Kabinet, admin paneli va Telegram ilovasi sanalmaydi: ular egasining o'z ishi,
 * tashrif emas. Yo'l tili prefiksisiz olinadi, aks holda /ru/dashboard bu ro'yxatga
 * tushmay, egasining har kuni tashrif bo'lib sanalardi.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { usePathname } from '@/i18n/navigation';
import { PRIVATE_PATH, getConsent, getConsentServer, subscribeConsent } from '@/lib/consent';

const KEY = 'ys-visit';

export function VisitBeacon() {
  const path = usePathname();
  const consent = useSyncExternalStore(subscribeConsent, getConsent, getConsentServer);

  useEffect(() => {
    // Rozilik berilmaguncha mayoq yuborilmaydi va ys-visit yozilmaydi: takrorni to'suvchi
    // belgisiz har sahifa ochilishi yangi tashrif bo'lib sanalardi. Ya'ni rozi bo'lmagan
    // odam tashrif sanog'iga umuman tushmaydi, bu ataylab.
    if (consent !== 'yes' || PRIVATE_PATH.test(path)) return;
    const today = new Date().toISOString().slice(0, 10);
    try {
      if (localStorage.getItem(KEY) === today) return;
      localStorage.setItem(KEY, today);
    } catch {
      // Saqlash yo'q (maxfiy oyna): mayoq yuborilmaydi, aks holda har sahifa
      // ochilishi yangi tashrif bo'lib sanalardi
      return;
    }
    // Javob kutilmaydi: sahifa chizilishiga ta'sir qilmasin
    void fetch('/api/v1/events/visit', { method: 'POST', keepalive: true }).catch(() => {});
  }, [path, consent]);

  return null;
}
