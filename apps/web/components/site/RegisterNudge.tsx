'use client';
/**
 * Mehmonga ro'yxatdan o'tish taklifi. Saytga kirganidan 3 daqiqa o'tgach bir marta
 * chiqadi: darrov chiqsa xalaqit beradi, umuman chiqmasa odam chat va telefon
 * hisob bilan ochilishini bilmay ketadi. Yopilsa 7 kun qayta chiqmaydi.
 * Vaqt sahifalar aro hisoblanadi: birinchi tashrif vaqti brauzerda saqlanadi.
 *
 * Kompyuterda chap pastda turadi: o'ng past chat oynasiniki, o'rta past taqqoslash
 * panelniki. z-40: chat (z-50) ochiq bo'lsa u ustun.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { UserCirclePlusIcon, XIcon } from '@phosphor-icons/react';
import { Link, usePathname } from '@/i18n/navigation';
import { hasSession } from '@/lib/api';
import { getConsent, getConsentServer, subscribeConsent } from '@/lib/consent';

const AFTER_MS = 3 * 60_000;
const SNOOZE_MS = 7 * 86_400_000;
const FIRST_KEY = 'ys-first-seen';
const SNOOZE_KEY = 'ys-nudge-snooze';

export function RegisterNudge() {
  const t = useTranslations('subscription.nudge');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const consent = useSyncExternalStore(subscribeConsent, getConsent, getConsentServer);

  useEffect(() => {
    // Rozilik berilmaguncha taklif umuman chizilmaydi: uning vaqtini (ys-first-seen,
    // ys-nudge-snooze) eslab qololmasak, taklif har sahifada qaytarardi. Pastdagi maxfiy
    // oyna qoidasi bilan bir xil sabab, faqat bu yerda qarorni odamning o'zi beradi.
    if (consent !== 'yes') return;
    // Forma to'ldirilayotgan sahifada taklif chiqmaydi: kirish qadami formaning o'zida
    // va oyna telefonda aynan yuborish tugmasi ustiga tushardi
    if (hasSession() || /^\/(login|signup|cargo\/new|services\/request)/.test(pathname)) return;
    let first = 0;
    let snoozed = 0;
    try {
      first = Number(localStorage.getItem(FIRST_KEY) || 0);
      snoozed = Number(localStorage.getItem(SNOOZE_KEY) || 0);
      if (!first) { first = Date.now(); localStorage.setItem(FIRST_KEY, String(first)); }
    } catch { return; } // saqlash yo'q (maxfiy oyna): taklif ham yo'q, har sahifada bezovta qilmaslik uchun
    if (snoozed > Date.now()) return;
    const id = setTimeout(() => { if (!hasSession()) setOpen(true); }, Math.max(0, first + AFTER_MS - Date.now()));
    return () => clearTimeout(id);
  }, [pathname, consent]);

  function close() {
    setOpen(false);
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS)); } catch { /* saqlanmasa keyingi sahifada yana chiqadi, xolos */ }
  }

  if (!open) return null;
  // role="dialog" olib tashlandi: bu taklif sahifani to'smaydi va fokusni ushlamaydi, ya'ni
  // ekran o'quvchiga oyna deb va'da berib, o'zini oyna kabi tutmasdi. Endi oddiy bo'lim:
  // odam sahifada erkin yuraveradi va fokus hech qayerga ko'chmagani uchun yopilganda ham
  // o'z joyida qoladi.
  // aside, div emas: rolsiz div ga qo'yilgan aria-labelledby ekran o'quvchida umuman
  // ishlamaydi (nomsiz umumiy element nom qabul qilmaydi), aside esa nom oladi va
  // ro'yxatda "yonaki mazmun" bo'lib ko'rinadi.
  return (
    // Pastki masofaga --ad-bottom qo'shiladi: pastdan chiquvchi reklama banneri
    // ko'rinib turgan bo'lsa taklif uning ustida qoladi. O'lchamni banner o'zi yozadi
    // (AdSlot.tsx), shunda balandlik bitta joyda hisoblanadi va bu yerda takrorlanmaydi.
    <aside aria-labelledby="nudge-title" className="fixed inset-x-4 bottom-[calc(1rem_+_var(--ad-bottom,0px))] z-40 mx-auto max-w-md rounded-card border border-line bg-white p-5 shadow-2xl sm:inset-x-auto sm:left-6 sm:mx-0">
      <div className="flex items-start gap-3">
        <UserCirclePlusIcon size={28} weight="fill" className="shrink-0 text-teal" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p id="nudge-title" className="font-display font-bold">{t('title')}</p>
          <p className="mt-1 text-sm text-muted">{t('body')}</p>
        </div>
        <button type="button" onClick={close} aria-label={t('close')} className="tap-40 relative -mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-sand hover:text-navy">
          <XIcon size={16} weight="bold" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/signup?next=${pathname}`} onClick={close} className="rounded-full bg-teal px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-ink">{t('cta')}</Link>
        <Link href={`/login?next=${pathname}`} onClick={close} className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-navy transition hover:border-teal">{t('login')}</Link>
        <button type="button" onClick={close} className="px-3 py-2.5 text-sm font-semibold text-muted hover:text-navy">{t('later')}</button>
      </div>
    </aside>
  );
}
