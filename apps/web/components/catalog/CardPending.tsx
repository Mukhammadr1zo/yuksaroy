'use client';
import { useLinkStatus } from 'next/link';

/**
 * Karta bosilgandan keyin sahifa kelguncha surat ustidagi parda va aylanma belgi.
 *
 * Nega: karta havolasi oldindan faqat niyatda yuklanadi (IntentLink), telefonda esa bosish bilan
 * sahifa orasida server javobi kutiladi va loading.tsx yo'q. Belgisiz ro'yxat qotib qolgandek
 * ko'rinadi, odam qayta bosadi. Parda doim joyida, faqat shaffofligi o'zgaradi, ya'ni hech narsa
 * siljimaydi. 100 ms kechikish tez ochilgan sahifada miltillashni yo'qotadi (Next hujjatidagi
 * useLinkStatus andozasi). Aylanish faqat kutishda: o'nlab karta bo'sh turganda animatsiya yurmaydi.
 * Link ichida, relative va overflow-hidden quti ichida turishi kerak.
 */
export function CardPending() {
  const { pending } = useLinkStatus();
  return (
    <span aria-hidden="true" className={`absolute inset-0 flex items-center justify-center bg-navy/45 transition-opacity duration-200 ${pending ? 'opacity-100 delay-100' : 'opacity-0'}`}>
      <span className={`size-5 rounded-full border-2 border-white/35 border-t-white ${pending ? 'animate-spin' : ''}`} />
    </span>
  );
}
