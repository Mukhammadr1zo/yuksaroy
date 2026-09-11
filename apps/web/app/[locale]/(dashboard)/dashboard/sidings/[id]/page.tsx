'use client';
// Shahobcha yo'lim: reestr ma'lumoti faqat o'qish uchun (rasmiy manbadan keladi),
// egasi esa rasm qo'shadi. Mijoz uchun raqam va uzunlikdan ko'ra yo'lning o'zi,
// rampasi va kirish yo'li ko'rinishi muhimroq.
import { use, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CLAIM_STATUS_LABELS, type ClaimStatus } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { num, uzDate } from '@/lib/format';
import type { MySiding } from '@/lib/types-kabinet';
import { BTN_GHOST, BTN_PRIMARY, Notice, useLang } from '@/components/kabinet/bits';
import { PhotoUpload } from '@/components/kabinet/PhotoUpload';

export default function MySidingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('kabinet.sidings');
  const tc = useTranslations('kabinet.common');
  const tr = useTranslations('region');
  const locale = useLocale();
  const lang = useLang();
  const [s, setS] = useState<MySiding | null | undefined>(undefined);
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  // Alohida GET yo'q: ro'yxat kichik (bir tashkilotda o'nlab yo'l), shu yerdan topiladi
  useEffect(() => {
    api<{ items: MySiding[] }>('/sidings/mine')
      .then((p) => setS(p.items.find((x) => x.id === id) ?? null))
      .catch(() => setS(null));
  }, [id]);

  useEffect(() => { if (s) setPhotos(s.photos ?? []); }, [s]);

  async function save() {
    setBusy(true); setNote(null);
    try {
      const next = await api<MySiding>(`/sidings/${id}`, { method: 'PATCH', body: JSON.stringify({ photos }) });
      setS(next);
      setNote({ tone: 'ok', text: tc('saved') });
    } catch { setNote({ tone: 'err', text: tc('failed') }); } finally { setBusy(false); }
  }

  if (s === undefined) return <p className="text-sm text-muted">{tc('loading')}</p>;
  if (s === null) {
    return (
      <div className="rounded-card border border-dashed border-line bg-white p-10 text-center">
        <p className="text-muted">{t('notFound')}</p>
        <Link href="/dashboard/objects" className={`${BTN_GHOST} mt-4 inline-flex`}>{t('backToObjects')}</Link>
      </div>
    );
  }

  const approved = s.claimStatus === 'APPROVED';
  const station = s.station?.nameUz ?? s.stationNameRaw;
  const facts: [string, string][] = [
    [t('col.no'), String(s.registryNo)],
    [t('col.station'), station],
    [t('col.region'), s.regionCode && tr.has(s.regionCode) ? tr(s.regionCode) : '·'],
    [t('col.length'), s.lengthM != null ? `${num(s.lengthM, locale)} m` : '·'],
    [t('unload'), t('wagons', { count: s.unloadCapacity })],
    [t('load'), t('wagons', { count: s.loadCapacity })],
    [t('col.status'), CLAIM_STATUS_LABELS[lang][s.claimStatus as ClaimStatus]],
  ];

  return (
    <>
      <nav aria-label="Yo'l" className="font-mono text-xs text-muted">
        <Link href="/dashboard/objects" className="hover:text-navy">{t('backToObjects')}</Link>
      </nav>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{t('one.title', { station, no: s.registryNo })}</h1>
          {s.claimedAt ? <p className="mt-1 text-sm text-muted">{t('one.claimedAt', { date: uzDate(s.claimedAt, locale) })}</p> : null}
        </div>
        {approved ? <Link href={`/sidings/${s.id}`} className={BTN_GHOST}>{t('open')}</Link> : null}
      </div>

      <section className="mt-6 overflow-hidden rounded-card border border-line bg-white">
        <h2 className="border-b border-line px-4 py-3 font-semibold">{t('one.registrySection')}</h2>
        <dl>
          {facts.map(([k, v]) => (
            <div key={k} className="flex items-start justify-between gap-4 border-t border-line/70 px-4 py-2.5 text-sm first:border-t-0">
              <dt className="text-muted">{k}</dt>
              <dd className="text-right font-mono font-semibold text-navy tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="border-t border-line px-4 py-3 text-xs text-muted">{t('one.registryNote')}</p>
      </section>

      <section className="mt-6 rounded-card border border-line bg-white p-4">
        <h2 className="font-semibold">{t('one.photosSection')}</h2>
        <p className="mt-0.5 text-sm text-muted">{t('one.photosHint')}</p>
        {approved ? (
          <>
            <div className="mt-3"><PhotoUpload photos={photos} onChange={setPhotos} /></div>
            {note ? <div className="mt-3"><Notice tone={note.tone}>{note.text}</Notice></div> : null}
            <button type="button" disabled={busy} onClick={() => void save()} className={`${BTN_PRIMARY} mt-4`}>
              {busy ? tc('saving') : tc('save')}
            </button>
          </>
        ) : (
          <div className="mt-3"><Notice tone="warn">{t('one.needApproval')}</Notice></div>
        )}
      </section>
    </>
  );
}
