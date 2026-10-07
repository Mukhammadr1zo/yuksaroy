'use client';
import { useState, type ComponentProps } from 'react';
import { Link } from '@/i18n/navigation';

/**
 * Sarlavha, futer va katalog kartasi havolasi: marshrut ko'rinishga kirganda emas, niyat
 * bilinganda (sichqoncha ustiga kelganda yoki barmoq tekkanda) oldindan yuklanadi
 * (Next hujjatidagi "hover-triggered prefetch" usuli).
 *
 * Nega: oddiy Link ko'ringan zahoti oldindan yuklaydi. Sarlavha va futerda 29 ta havola bor, ya'ni
 * har sahifa ochilishida ular o'nlab so'rov yuborardi, logotip esa har safar bosh sahifa bilan
 * birga til lug'atini (60 KB) tortardi. Katalog sahifalari dinamik va loading.tsx yo'q, shuning
 * uchun ularning oldindan yuklanishi bosishni baribir tezlatmasdi: sahifa bosilganda serverdan
 * so'raladi. Ro'yxat va xarita yon panelidagi o'nlab karta ham shunday so'rov yuborardi, telefonda
 * esa bu so'rovlar xarita qatlamlari va suratlar bilan bitta kanalni talashardi.
 * prefetch={false} yetmaydi: Next 16 da u sichqoncha va teginishdagi yuklashni ham o'chiradi.
 * Telefonda barmoq tekkani bosishdan biroz oldin keladi, qolgan kutishni karta o'zi ko'rsatadi
 * (CardPending). Chaqiruvchining o'z onMouseEnter va onTouchStart i ham chaqiriladi, yutilmaydi.
 * prefetch esa turdan olingan: uni faqat shu yer belgilaydi, chaqiruvchi bergani jimgina almashib
 * ketmasin, tsc xato bersin. Boshqacha yuklash kerak bo'lsa oddiy Link olinadi.
 */
export function IntentLink(props: Omit<ComponentProps<typeof Link>, 'prefetch'>) {
  const [hot, setHot] = useState(false);
  return (
    <Link
      {...props}
      prefetch={hot ? null : false}
      onMouseEnter={(e) => { props.onMouseEnter?.(e); setHot(true); }}
      onTouchStart={(e) => { props.onTouchStart?.(e); setHot(true); }}
    />
  );
}
