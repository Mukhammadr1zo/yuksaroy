'use client';
/**
 * Oylik tushum: tasdiqlangan to'lovlar, oylar bo'yicha, yangisi yuqorida.
 *
 * Har ustun bitta qaror uchun:
 * jami - shu oy xarajatni qopladimi;
 * obuna va Premium - pul qaysi mahsulotdan keladi (Premium ketma-ket nol bo'lsa uning
 * navbati va kodini yopish mumkin);
 * to'lovlar soni - qo'lda tasdiqlash qachon og'irlik qila boshlaydi;
 * uzaytirish - pul yangi odamlardan keladimi yoki qolganlardan, ya'ni kuchni jalb
 * qilishga sarflash kerakmi yoki ushlab qolishga.
 */
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { num, som, uzMonthYear } from '@/lib/format';
import { DataTable, Notice, PageHead, errText, type Col } from '@/components/admin/kit';

type Row = { month: string; totalTiyin: number; subsTiyin: number; premiumTiyin: number; payments: number; renewals: number };

export default function AdminRevenuePage() {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const tr = useTranslations('admin.revenue');
  const locale = useLocale();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<unknown>(null);

  useEffect(() => { api<{ months: Row[] }>('/admin/revenue').then((r) => setRows(r.months)).catch(setErr); }, []);

  const hasPremium = !!rows?.some((r) => r.premiumTiyin > 0);
  // Oy kaliti "2026-09": kun o'rtasi olinadi, shunda hech bir mintaqada oy chegarasidan sakramaydi
  const label = (m: string) => uzMonthYear(new Date(`${m}-01T12:00:00Z`), locale);
  const cols: Col<Row>[] = [
    { key: 'month', head: tr('month'), cell: (r) => label(r.month) },
    { key: 'total', head: tr('total'), num: true, cell: (r) => som(r.totalTiyin, locale) },
    { key: 'subs', head: tr('subs'), num: true, cell: (r) => som(r.subsTiyin, locale) },
    ...(hasPremium ? [{ key: 'premium', head: tr('premium'), num: true, cell: (r: Row) => som(r.premiumTiyin, locale) }] : []),
    { key: 'payments', head: tr('payments'), num: true, cell: (r) => num(r.payments, locale) },
    { key: 'renewals', head: tr('renewals'), num: true, cell: (r) => num(r.renewals, locale) },
  ];

  return (
    <>
      <PageHead title={t('nav.revenue')} lead={tr('lead')} />
      {err ? <Notice tone="err">{errText(err, t, t.has, tc('loadFailed'))}</Notice> : null}
      {!rows && !err ? <p className="mt-5 text-sm text-muted">{tc('loading')}</p> : null}
      {rows ? <DataTable cols={cols} rows={rows} keyOf={(r) => r.month} empty={tr('empty')} /> : null}
      {rows && !hasPremium ? <p className="mt-3 text-xs text-muted">{tr('noPremium')}</p> : null}
    </>
  );
}
