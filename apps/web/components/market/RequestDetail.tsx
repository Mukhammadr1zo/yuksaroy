'use client';
// So'rov tafsiloti (yuk yoki xizmat): faktlar, tavsif, egasining telefoni (obunachiga), taklif formasi.
import { useEffect, useState } from 'react';
import { PhotoStrip } from './PhotoStrip';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRightIcon, TelegramLogoIcon } from '@phosphor-icons/react';
import { Link } from '@/i18n/navigation';
import { api, hasSession } from '@/lib/api';
import { regionRouteKm } from '@yuksaroy/domain';
import { km, uzDate, uzDateTime } from '@/lib/format';
import type { MarketRequest } from '@/lib/types-market';
import { BTN_GHOST, Notice } from '@/components/kabinet/bits';
import { DemoBadge, MarketPhone, MarketStatusPill, useMarketLabels } from './bits';
import { OfferForm } from './OfferForm';
import { requestHref } from './RequestCard';
import { ReportButton } from '@/components/site/ReportButton';

export function RequestDetail({ r }: { r: MarketRequest }) {
  const locale = useLocale();
  const cargo = r.board === 'CARGO';
  const t = useTranslations(cargo ? 'cargo.detail' : 'services.requestDetail');
  const td = useTranslations('services.detail');
  const ta = useTranslations('a11y');
  const L = useMarketLabels();
  const next = requestHref(r);
  /*
   * Sahifa serverda cookie'siz va keshlangan holda yasaladi, ya'ni javobdagi myOffer
   * doim bo'sh. Tanlangan ijrochi esa aynan shu yerda buyurtmachining raqamini
   * ko'rishi kerak, shuning uchun so'rov brauzerda bir marta qayta o'qiladi va
   * natija taklif formasiga ham beriladi (ikki marta so'ralmasin).
   */
  const [me, setMe] = useState<MarketRequest | null>(null);
  useEffect(() => {
    if (r.isDemo || !hasSession()) return;
    let alive = true;
    api<MarketRequest>(`/market/requests/${encodeURIComponent(r.no)}`)
      .then((x) => { if (alive) setMe(x); })
      .catch(() => {});
    return () => { alive = false; };
  }, [r.no, r.isDemo]);
  // Tanlangan ijrochi: sahifa unga "Sizni tanlashdi" deydi (2026-11-02). Yopilgan deb aldamaydi
  const won = me?.myOffer?.status === 'AWARDED' && (r.status === 'AWARDED' || r.status === 'DONE');
  // Ulashish havolasi brauzerda yig'iladi (domen sahifadan); ?from=share ni OfferForm auditga yozadi
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  const shareHref = origin ? `https://t.me/share/url?url=${encodeURIComponent(`${origin}${next}?from=share`)}&text=${encodeURIComponent(t('shareText', { title: r.title }))}` : null;
  // Faqat yuk so'rovida: xizmat so'rovida yo'nalish yo'q
  const routeKm = cargo ? regionRouteKm(r.fromRegion, r.toRegion) : null;
  const facts: [string, React.ReactNode][] = cargo
    ? [
        [t('route'), <span key="r" className="inline-flex flex-wrap items-center gap-1">{L.region(r.fromRegion)}<ArrowRightIcon size={14} className="text-teal" aria-hidden="true" />{L.region(r.toRegion)}</span>],
        [t('cargo'), r.cargoName ?? ''],
        [t('weight'), r.weightT != null ? `${r.weightT} t` : ''],
        [t('loadDate'), r.loadDate ? uzDate(r.loadDate, locale) : ''],
        [t('truck'), r.truckType ? L.truck(r.truckType) : L.truck(null) || '-'],
        // Uch maydon ixtiyoriy: to'ldirilmagani jadvalga umuman tushmaydi
        ...(r.volumeM3 != null ? [[t('volume'), `${r.volumeM3} m3`] as [string, React.ReactNode]] : []),
        ...(r.trucksCount != null && r.trucksCount > 1 ? [[t('trucks'), String(r.trucksCount)] as [string, React.ReactNode]] : []),
        ...(r.paymentTerm ? [[t('payment'), L.payment(r.paymentTerm)] as [string, React.ReactNode]] : []),
        // Viloyat markazlari orasidagi masofa: taklif narxini km ga bo'lib ko'rish uchun asos.
        // Bir viloyat ichidagi yo'nalishda katak umuman chiqmaydi (0 km qaror bermaydi)
        ...(routeKm != null ? [[t('distance'), km(routeKm, locale)] as [string, React.ReactNode]] : []),
      ]
    : [
        [t('type'), r.serviceType ? L.service[r.serviceType] : ''],
        [t('region'), L.region(r.regionCode)],
      ];

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href={cargo ? '/cargo' : '/services'} className="text-sm font-semibold text-teal-ink hover:text-navy">{t('back')}</Link>
      <p className="mt-4 font-mono text-xs uppercase tracking-wide text-teal-ink">{t('eyebrow')} · {r.no}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display min-w-0 text-3xl font-bold text-navy wrap-anywhere">{r.title}</h1>
        <MarketStatusPill status={r.status} />
        {r.isDemo ? <DemoBadge /> : null}
      </div>
      <p className="mt-1 font-mono text-xs text-muted tabular-nums">{t('created')}: {uzDateTime(r.createdAt, locale)}</p>
      {r.isDemo ? <div className="mt-4"><Notice tone="warn">{td('demoNote')}</Notice></div> : null}

      <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {facts.map(([k, v]) => (
          <div key={k} className="min-w-0 rounded-card border border-line bg-white px-4 py-3">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="mt-1 font-semibold wrap-anywhere">{v || '-'}</dd>
          </div>
        ))}
      </dl>
      {cargo && (r.fromText || r.toText) ? <p className="mt-3 text-sm text-muted wrap-anywhere">{[r.fromText, r.toText].filter(Boolean).join(' - ')}</p> : null}

      {/* Yuk e'lonida tavsif ixtiyoriy: bo'sh bo'lsa bo'sh sarlavha turmasin */}
      {r.description.trim() ? (
        <section className="mt-4 rounded-card border border-line bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{t('description')}</h2>
          <p className="mt-2 whitespace-pre-line text-sm wrap-anywhere">{r.description}</p>
        </section>
      ) : null}
      <PhotoStrip photos={r.photos} alt={ta('photoOf', { name: r.title })} />

      {/* Tanlangan ijrochi: nima bo'lgani va buyurtmachi raqami. Raqam faqat buyurtmachi tanlash paytida
          tasdiqlagan bo'lsa bor (hasPhone); rad etgan bo'lsa shuni ochiq aytadi. ish bajarilgach ham qoladi */}
      {won && !r.isDemo ? (
        <section className="mt-4 rounded-card border border-teal bg-teal-soft/40 p-4" aria-live="polite">
          <h2 className="font-display text-lg font-bold text-navy">{t('chosenTitle')}</h2>
          <p className="mt-1 text-sm text-ink/85">{r.hasPhone ? t('chosenLead') : t('chosenNoPhone')}</p>
          {r.hasPhone ? <div className="mt-3"><MarketPhone kind="request" targetId={r.id} next={next} /></div> : null}
        </section>
      ) : null}
      {/* Ochiq so'rovda raqam har kirgan obunachiga ochiq: taklif berish uchun kerak */}
      {r.hasPhone && !r.isDemo && r.status === 'OPEN' ? (
        <section className="mt-4 rounded-card border border-line bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{t('phone')}</h2>
          <div className="mt-2"><MarketPhone kind="request" targetId={r.id} next={next} /></div>
        </section>
      ) : null}

      <section className="mt-8 rounded-card border border-teal/40 bg-sand p-5">
        <h2 className="font-display text-xl font-bold text-navy">{me?.myOffer ? t('myOfferTitle') : t('offerTitle')}</h2>
        {cargo && !me?.myOffer ? <p className="mt-1 text-sm text-muted">{t('offerLead')}</p> : null}
        <div className="mt-4">
          {r.isDemo ? <><OfferForm request={r} next={next} preview /><p className="mt-3 text-sm text-muted">{td('demoNote')}</p></>
            : r.status !== 'OPEN' && cargo && !me?.myOffer ? <Notice tone="warn">{t('closedNote')}</Notice>
            : <OfferForm request={r} next={next} me={me} />}
        </div>
      </section>
      {/* Ochiq yukni ulashish: oddiy t.me havolasi, ochilgan odam Telegramda guruh yoki do'stni tanlaydi */}
      {cargo && !r.isDemo && r.status === 'OPEN' && shareHref ? (
        <div className="mt-6">
          <a href={shareHref} target="_blank" rel="noreferrer" className={`${BTN_GHOST} inline-flex items-center gap-2`}>
            <TelegramLogoIcon size={18} aria-hidden="true" />{t('share')}
          </a>
        </div>
      ) : null}
      {r.isDemo ? null : <div className="mt-8"><ReportButton kind="request" targetId={r.id} /></div>}
    </div>
  );
}
