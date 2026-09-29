'use client';
/**
 * Ichki izohlar: qo'ng'iroq natijasi, kelishuv, shubha. Faqat jamoa ko'radi, obyekt
 * egasiga hech qayerda chiqmaydi (API faqat /admin/notes orqali beradi). Yozish operatorga
 * ham ochiq, o'chirish faqat egada: operator o'z izini o'chira olmasin, matn jurnalda qoladi.
 */
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api, post } from '@/lib/api';
import { uzDateTime } from '@/lib/format';
import { phoneDisplay } from '@/components/ui/fields';
import { BTN, CARD, ConfirmButton, INPUT, Notice, Skeleton, errText, useAdminList } from './kit';
import { useAdminMe } from './context';
import type { NoteEntity } from './ObjectPage';

type Note = {
  id: string; entity: string; entityId: string; text: string; createdAt: string;
  author: { id: string; fullName: string | null; phone: string | null } | null;
};

const MAX = 2000;
/** Bitta obyektda yuzdan ortiq izoh kutilmaydi: sahifalagichsiz, bir so'rov. */
const LIMIT = 100;

export function NotesTab({ entity, entityId, onCount }: { entity: NoteEntity; entityId: string; onCount?: (n: number) => void }) {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const tn = useTranslations('admin.notes');
  const locale = useLocale();
  const { isOwner } = useAdminMe();
  const { data, loading, err, reload } = useAdminList<Note>('/admin/notes', { entity, entityId, limit: LIMIT });
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  // Yorliqdagi son ro'yxat bilan bir xil bo'lsin; ref orqali: har renderda yangi funksiya effektni aylantirmasin
  const cb = useRef(onCount);
  cb.current = onCount;
  useEffect(() => { if (data && !err) cb.current?.(data.total); }, [data, err]);

  async function add() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true); setNote(null);
    try {
      await post('/admin/notes', { entity, entityId, text: body });
      setText('');
      setNote({ tone: 'ok', text: tn('added') });
      await reload();
    } catch (e) { setNote({ tone: 'err', text: errText(e, t, t.has, tc('saveFailed')) }); } finally { setBusy(false); }
  }

  async function remove(id: string) {
    setNote(null);
    try {
      await api(`/admin/notes/${id}`, { method: 'DELETE' });
      setNote({ tone: 'ok', text: tn('deleted') });
      await reload();
    } catch (e) { setNote({ tone: 'err', text: errText(e, t, t.has, tc('deleteFailed')) }); }
  }

  const who = (a: Note['author']) => (a ? a.fullName || (a.phone ? phoneDisplay(a.phone) : a.id) : tn('deletedUser'));

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); void add(); }} className={`${CARD} p-3`}>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">{tn('title')}</span>
          <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX} rows={3} placeholder={tn('placeholder')}
            // Ctrl+Enter yuboradi: uzun izohda Enter yangi qator bo'lib qolsin
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void add(); } }}
            className={INPUT} />
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="submit" disabled={busy || !text.trim()} className={BTN}>{tn('add')}</button>
          <span className="text-[11px] text-muted">{tn('ctrlEnter')}</span>
          {text.length >= MAX ? <span className="text-[11px] text-red-700">{tn('tooLong')}</span> : null}
          <span className="ml-auto font-mono text-[11px] tabular-nums text-muted">{text.length}/{MAX}</span>
        </div>
      </form>

      {note ? <Notice tone={note.tone}>{note.text}</Notice> : null}
      {err ? <Notice tone="err">{errText(err, t, t.has, tc('loadFailed'))}</Notice> : null}

      {loading && !data ? <div className={`${CARD} px-4 py-5`}><Skeleton rows={3} /></div>
        : !data?.items.length ? <p className={`${CARD} border-dashed px-6 py-8 text-center text-sm text-muted`}>{tn('empty')}</p>
        : (
          <ul className={`${CARD} divide-y divide-line/70`}>
            {data.items.map((n) => (
              <li key={n.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`font-semibold ${n.author ? 'text-navy' : 'text-muted'}`}>{who(n.author)}</span>
                  <span className="font-mono text-[11px] text-muted">{uzDateTime(n.createdAt, locale)}</span>
                  {isOwner ? (
                    <span className="ml-auto">
                      <ConfirmButton label={tn('delete')} confirm={tc('confirm')} onRun={() => remove(n.id)}
                        className="inline-flex items-center rounded-full border border-red-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-red-700 transition duration-150 hover:bg-red-50 disabled:opacity-60" />
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 whitespace-pre-line break-words text-sm text-ink">{n.text}</p>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
