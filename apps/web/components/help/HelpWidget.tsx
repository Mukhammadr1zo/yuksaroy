'use client';
/**
 * Yordam chati: o'ng pastdagi dumaloq tugma va ustida ochiladigan kichik oyna.
 * Avval tayyor savollar (chip), keyin erkin savol: server lug'atdan yoki AI dan javob beradi,
 * ostida "Batafsil" havolalari. Suhbat faqat komponent holatida: sahifa yangilansa yo'qoladi,
 * bu ataylab, hech narsa saqlanmaydi.
 *
 * Joylashuv: o'ng past z-40. Chat oynasi (z-50) ochilsa u ustun, bu to'g'ri: odam egasi bilan
 * yozishyapti. Kompyuterda chap past ro'yxatdan o'tish taklifiniki, o'rta past solishtirish savatiniki.
 * Telefonda (sm dan tor) ikkalasi ham butun enni oladi va o'ng pastga yetib keladi: shu paytda tugma
 * chizilmaydi, aks holda ularning tugmalarini bosib qo'yardi. Qoida bitta va shu yerda, z-index emas.
 * Telegram Mini App (/tg) da chizilmaydi: u yerda o'z pastki panel bor.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChatCircleDotsIcon, PaperPlaneRightIcon, XIcon } from '@phosphor-icons/react';
import { Link, usePathname } from '@/i18n/navigation';
import { DashLink } from '@/components/site/DashLink';
import { ApiError, api, post } from '@/lib/api';
import { getCompare, getCompareServer, subscribeCompare } from '@/lib/compare';

type Faq = { id: string; q: string; a: string; href: string };
type Related = { id: string; q: string; href: string };
type Ask = { answer: string | null; source: 'faq' | 'llm' | 'none'; related: Related[]; limited?: boolean };
type Msg = { id: number; mine: boolean; text: string; related?: Related[]; note?: 'noAnswer' | 'limited' };

// Boshlang'ich chiplar: eng ko'p so'raladiganlar, tartib muhim (birinchi ikkitasi mobil ekranda ko'rinadi)
const STARTERS = ['find-terminal', 'contact-owner', 'register', 'book', 'subscription', 'free'];
let seq = 0;

// Ro'yxatdan o'tish taklifi o'z holatini tashqariga bermaydi: DOM da turgan-turmaganini kuzatamiz
const subscribeDom = (cb: () => void) => {
  const mo = new MutationObserver(cb);
  mo.observe(document.body, { childList: true, subtree: true });
  return () => mo.disconnect();
};
const nudgeShown = () => document.getElementById('nudge-title') !== null;

export function HelpWidget() {
  const t = useTranslations('help');
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [faq, setFaq] = useState<Faq[] | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const compare = useSyncExternalStore(subscribeCompare, getCompare, getCompareServer);
  const nudge = useSyncExternalStore(subscribeDom, nudgeShown, () => false);
  // Savat solishtirish sahifasida chizilmaydi (CompareTray bilan bir xil shart)
  const trayShown = !pathname.includes('/compare') && Object.values(compare).some((items) => items.length > 0);
  // Telefonda burchak band: tugma faqat sm dan keng ekranda
  const cornerBusy = open || trayShown || nudge;

  // Ro'yxat bir marta, faqat oyna ochilganda: vidjet har sahifada bor, so'rovni bekorga yubormaymiz
  useEffect(() => {
    if (!open || faq) return;
    api<Faq[]>(`/help/faq?locale=${locale}`).then(setFaq).catch(() => setFaq([]));
  }, [open, faq, locale]);

  // Oyna yopilganda fokus uni ochgan tugmaga qaytadi: klaviatura bilan yurgan odam
  // Esc bosgach sahifaning boshiga tushib qolmasin, turgan joyida davom etsin
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); prev?.focus(); };
  }, [open]);

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs, busy]);

  if (pathname.startsWith('/tg')) return null;

  const push = (m: Omit<Msg, 'id'>) => setMsgs((s) => [...s, { ...m, id: ++seq }]);

  /** Tayyor savol: javob allaqachon qo'lda, serverga bormaymiz. */
  function pick(f: Faq) {
    push({ mine: true, text: f.q });
    push({ mine: false, text: f.a, related: [{ id: f.id, q: f.q, href: f.href }] });
  }

  async function send() {
    const q = text.trim();
    if (!q || busy) return;
    setText('');
    setErr(null);
    push({ mine: true, text: q });
    setBusy(true);
    try {
      const r = await post<Ask>('/help/ask', { q, locale });
      push({
        mine: false,
        text: r.answer ?? t('noAnswer'),
        related: r.related,
        note: r.limited ? 'limited' : r.answer ? undefined : 'noAnswer',
      });
    } catch (e) {
      setErr(e instanceof ApiError && e.status === 429 ? t('tooMany') : t('error'));
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }

  const starters = faq ? STARTERS.map((id) => faq.find((f) => f.id === id)).filter((f): f is Faq => !!f) : [];

  return (
    <>
      <button
        type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="help-widget" aria-label={t('open')}
        // display faqat bitta joydan keladi: asosiy ro'yxatda ham inline-flex bo'lsa,
        // Tailwind da hidden bilan ikkisi bir xil xususiyatni belgilab, qaysi biri ustun
        // bo'lishini sinf tartibi emas, stil fayli tartibi hal qilardi va tugma yashirinmasdi
        // Pastki masofaga --ad-bottom qo'shiladi: pastdan chiquvchi reklama banneri ko'rinib
        // turgan bo'lsa tugma uning ustiga ko'chadi. O'lchamni banner o'zi yozadi (AdSlot.tsx),
        // shunda balandlik bitta joyda hisoblanadi va uch joyda takrorlanmaydi.
        className={`fixed bottom-[calc(1.5rem_+_var(--ad-bottom,0px))] right-4 z-40 h-12 items-center gap-2 rounded-full bg-navy pl-3 pr-4 text-sm font-semibold text-white shadow-lg transition hover:bg-navy-2 active:scale-[0.98] sm:right-6 ${cornerBusy ? 'hidden sm:inline-flex' : 'inline-flex'}`}
      >
        <ChatCircleDotsIcon size={22} weight="fill" aria-hidden="true" />
        <span className="hidden sm:inline">{t('open')}</span>
      </button>

      {open ? (
        <div
          id="help-widget" role="dialog" aria-label={t('title')}
          // Kompyuterdagi pastki masofaga --ad-bottom qo'shiladi: reklama banneri ko'rinib
          // turgan bo'lsa oyna uning ustida ochiladi. O'lchamni banner o'zi yozadi (AdSlot.tsx).
          // Telefonda ham shu o'lcham qo'shiladi: banner ochiq oynada chizilmaydi, lekin
          // cookie roziligi chizig'i chiziladi va usiz oynaning yozish maydonini yopardi.
          className="fixed inset-x-0 bottom-[var(--ad-bottom,0px)] z-40 flex max-h-[85dvh] flex-col rounded-t-card border border-line bg-white shadow-2xl sm:inset-x-auto sm:bottom-[calc(6rem_+_var(--ad-bottom,0px))] sm:right-6 sm:h-[520px] sm:max-h-[calc(100dvh-8rem)] sm:w-[380px] sm:rounded-card"
        >
          <header className="flex items-center gap-2 border-b border-line px-4 py-3">
            <p className="min-w-0 flex-1 truncate font-display text-sm font-bold text-navy">{t('title')}</p>
            <Link href="/help" onClick={() => setOpen(false)} className="text-xs font-semibold text-teal-ink hover:underline">{t('all')}</Link>
            <button type="button" onClick={() => setOpen(false)} aria-label={t('close')} className="tap-40 relative -mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-sand hover:text-navy">
              <XIcon size={16} weight="bold" aria-hidden="true" />
            </button>
          </header>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-sand/40 px-3 py-3">
            <Bubble mine={false}>{t('greeting')}</Bubble>
            {starters.length ? (
              <div className="pb-1">
                <p className="mb-1.5 px-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted">{t('starters')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {starters.map((f) => (
                    <button key={f.id} type="button" onClick={() => pick(f)} className="max-w-full rounded-full border border-line bg-white px-3 py-1.5 text-left text-xs font-semibold text-ink transition hover:border-teal hover:text-navy wrap-anywhere">
                      {f.q}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {msgs.map((m) => (
              <Bubble key={m.id} mine={m.mine}>
                {m.text}
                {m.note ? <span className="mt-1 block text-xs text-muted">{t(m.note)}</span> : null}
                {!m.mine && (m.related?.length || m.note) ? (
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {m.related?.map((r) => (
                      <DashLink key={r.id} href={r.href} onClick={() => setOpen(false)} className="max-w-full rounded-full bg-sand px-2.5 py-1 text-xs font-semibold text-teal-ink transition hover:bg-line wrap-anywhere">
                        {t('related')}: {r.q}
                      </DashLink>
                    ))}
                    {m.note ? <Link href="/contact" onClick={() => setOpen(false)} className="rounded-full bg-navy px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-navy-2">{t('contact')}</Link> : null}
                  </span>
                ) : null}
              </Bubble>
            ))}
            {busy ? <Bubble mine={false}><span className="text-muted">{t('thinking')}</span></Bubble> : null}
            <div ref={end} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="border-t border-line px-3 py-2">
            {err ? <p role="alert" className="mb-1 text-xs font-semibold text-red-700">{err}</p> : null}
            <div className="flex items-center gap-2">
              <input
                ref={input} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder={t('placeholder')} aria-label={t('placeholder')}
                className="h-11 w-full min-w-0 rounded-xl border border-field bg-white px-3 text-sm outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/25"
              />
              <button type="submit" disabled={busy || !text.trim()} aria-label={t('send')} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal text-white transition hover:bg-teal-ink disabled:opacity-50">
                <PaperPlaneRightIcon size={18} weight="fill" aria-hidden="true" />
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

function Bubble({ mine, children }: { mine: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[88%] min-w-0 rounded-2xl px-3 py-2 text-sm wrap-anywhere ${mine ? 'bg-navy text-white' : 'bg-white text-ink ring-1 ring-line'}`}>{children}</div>
    </div>
  );
}
