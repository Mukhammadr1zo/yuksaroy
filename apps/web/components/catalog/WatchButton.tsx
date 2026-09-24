'use client';
// Kuzatuv tugmasi FAQAT bo'sh natija ekranida turadi: natija chiqqan joyda odamga
// ko'rsatadigan narsa bor, kuzatuv esa aynan "hozir yo'q" holatining javobi.
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { WATCH_MAX } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { post } from '@/lib/api';
import { errText } from '@/components/kabinet/bits';
import { useAuthed } from '@/components/site/AuthOnly';

const BTN = 'rounded-full border border-teal bg-white px-6 py-3 font-semibold text-teal-ink transition duration-200 hover:bg-teal-soft active:scale-[0.98] disabled:opacity-60';

type Props = {
  kind: 'CARGO' | 'LISTING';
  /** Faqat oq ro'yxatdagi maydonlar; bo'sh qiymatlar yuborilmaydi. */
  params: Record<string, string | undefined>;
  /** Mehmon kirgandan keyin qaytadigan manzil. */
  next: string;
};

export function WatchButton({ kind, params, next }: Props) {
  const t = useTranslations('listing.watch');
  const te = useTranslations('listing.watch.err');
  const authed = useAuthed();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (authed === undefined) return null; // tekshirilguncha hech narsa
  if (!authed) return <Link href={`/signup?next=${encodeURIComponent(next)}`} className={BTN}>{t('guest')}</Link>;
  if (done) return <p role="status" className="text-sm font-semibold text-teal-ink">{t('done')}</p>;

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const body = Object.fromEntries(Object.entries(params).filter(([, v]) => !!v));
      await post('/watches', { kind, ...body });
      setDone(true);
    } catch (e) {
      // errText mavjud yordamchi: ApiError dan kodni oladi, tarjima bo'lmasa umumiy
      // matnga tushadi. Ikkinchi nusxa yozilmaydi.
      setErr(errText(e, (k) => te(k, { max: WATCH_MAX }), te.has, te('FAILED')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" disabled={busy} onClick={() => void save()} className={BTN}>
        {busy ? t('busy') : t('cta')}
      </button>
      {err ? <p role="alert" className="mt-2 w-full text-sm font-semibold text-red-700">{err}</p> : null}
    </>
  );
}
