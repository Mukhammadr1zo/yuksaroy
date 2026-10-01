'use client';
// Yozishmadagi fayllar: yuborishdan oldingi tanlov va yuborilgandan keyingi ko'rinish.
// Rasm darhol ko'rinadi, hujjat esa nomi va o'lchami bilan chiqadi: yuk hujjatini
// ochmasdan ham qaysi fayl ekanini bilish kerak.
import { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FileArrowDownIcon, FilePdfIcon, FileXlsIcon, FileDocIcon, PaperclipIcon, XIcon } from '@phosphor-icons/react';
import { uploadOne, type Uploaded } from '@/components/kabinet/PhotoUpload';

export const MAX_ATTACHMENTS = 10;
export const CHAT_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf,.pdf,.docx,.xlsx';

export type Attachment = Uploaded;

const isImage = (url: string) => /\.(?:jpg|png|webp)$/.test(url);

/** Bayt emas, odam o'qiydigan o'lcham. */
export function fileSize(bytes: number): string {
  if (bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ name }: { name: string }) {
  const props = { size: 20, weight: 'fill' as const, 'aria-hidden': true };
  if (/\.pdf$/i.test(name)) return <FilePdfIcon {...props} />;
  if (/\.xlsx?$/i.test(name)) return <FileXlsIcon {...props} />;
  if (/\.docx?$/i.test(name)) return <FileDocIcon {...props} />;
  return <FileArrowDownIcon {...props} />;
}

/**
 * Biriktirilgan fayllar holati bitta joyda.
 *
 * Nega hook: fayl ikki yo'l bilan qo'shiladi, tugma orqali va matnga qo'yish orqali.
 * Ilgari ikkalasi alohida holat yuritardi: qo'yilgan fayl xatosi jimgina yo'qolar,
 * ikkitasi bir vaqtda yuklansa biri ro'yxatdan tushib qolar, yuklash tugamasdan
 * yuborilgan xabar esa faylsiz ketib, fayl keyingi xabarga ilashib qolardi.
 */
export function useAttachments() {
  const t = useTranslations('kabinet.chat');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  // Haqiqiy ro'yxat ref da: ketma-ket yuklashlar bir-birining natijasini o'chirmasin
  const current = useRef<Attachment[]>([]);
  const inflight = useRef(0);

  const commit = useCallback((next: Attachment[]) => { current.current = next; setFiles(next); }, []);

  const message = useCallback((code?: string) => (code && t.has(`err.${code}`) ? t(`err.${code}`) : t('err.UPLOAD')), [t]);

  const add = useCallback(async (list: File[]) => {
    if (!list.length) return;
    setErr(null);
    const room = MAX_ATTACHMENTS - current.current.length - inflight.current;
    const chosen = list.slice(0, Math.max(0, room));
    if (chosen.length < list.length) setErr(t('tooManyFiles', { max: MAX_ATTACHMENTS }));
    if (!chosen.length) return;
    inflight.current += chosen.length;
    setBusy((n) => n + chosen.length);
    for (const f of chosen) {
      try {
        const r = await uploadOne(f);
        if (r.file?.url) commit([...current.current, r.file]);
        else setErr(message(r.code));
      } catch { setErr(message()); } finally {
        inflight.current -= 1;
        setBusy((n) => n - 1);
      }
    }
  }, [commit, message, t]);

  const remove = useCallback((i: number) => commit(current.current.filter((_, j) => j !== i)), [commit]);
  const clear = useCallback(() => { commit([]); setErr(null); }, [commit]);

  return { files, busy, err, add, remove, clear };
}

/** Tanlangan fayllar. Yozish maydonining ustida, to'liq kenglikda turadi. */
export function AttachmentChips({ files, onRemove }: { files: Attachment[]; onRemove: (i: number) => void }) {
  const t = useTranslations('kabinet.chat');
  if (!files.length) return null;
  return (
    <ul className="mb-2 flex flex-wrap gap-1.5">
      {files.map((f, i) => (
        <li key={f.url} className="flex max-w-full items-center gap-1.5 rounded-full border border-line bg-white py-1 pl-2.5 pr-1 text-xs">
          <FileIcon name={f.name} />
          <span className="min-w-0 truncate font-semibold">{f.name}</span>
          <span className="shrink-0 font-mono text-[10px] text-muted">{fileSize(f.size)}</span>
          <button
            type="button" aria-label={t('removeFile', { name: f.name })} onClick={() => onRemove(i)}
            className="tap-40 relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-sand hover:text-red-700"
          >
            <XIcon size={12} weight="bold" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Faqat tugma: yozish qatorida turadi, shuning uchun kengligi qat'iy 52px. */
export function AttachmentButton({ busy, disabled, onPick }: { busy: number; disabled?: boolean; onPick: (f: File[]) => void }) {
  const t = useTranslations('kabinet.chat');
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button" onClick={() => input.current?.click()} disabled={disabled || busy > 0}
        aria-label={t('attach')} title={t('attach')}
        className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl border border-line bg-white text-muted transition hover:border-teal hover:text-teal-ink disabled:opacity-50"
      >
        {busy > 0 ? <span className="font-mono text-xs">{busy}</span> : <PaperclipIcon size={18} aria-hidden="true" />}
      </button>
      <input
        ref={input} type="file" accept={CHAT_ACCEPT} multiple hidden
        onChange={(e) => { onPick(Array.from(e.target.files ?? [])); e.target.value = ''; }}
      />
    </>
  );
}

/** Yuborilgan xabardagi fayllar. `mine` faqat rang uchun. */
export function MessageFiles({ files, mine }: { files: Attachment[]; mine: boolean }) {
  const t = useTranslations('kabinet.chat');
  if (!files.length) return null;
  const images = files.filter((f) => isImage(f.url));
  const docs = files.filter((f) => !isImage(f.url));
  return (
    <div className="mt-1.5 space-y-1.5">
      {images.length ? (
        <ul className={`grid gap-1.5 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {images.map((f) => (
            <li key={f.url}>
              <a href={f.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl ring-1 ring-black/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt={t('imageAlt', { name: f.name })} loading="lazy" className={`w-full object-cover ${images.length === 1 ? 'max-h-72' : 'aspect-square'}`} />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {docs.map((f) => (
        <a
          key={f.url} href={f.url} target="_blank" rel="noopener noreferrer" download={f.name}
          title={t('download')}
          className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm transition ${mine ? 'bg-white/15 hover:bg-white/25' : 'bg-white ring-1 ring-line hover:ring-teal'}`}
        >
          <FileIcon name={f.name} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold wrap-anywhere">{f.name}</span>
            {f.size ? <span className={`block font-mono text-[10px] ${mine ? 'text-white/70' : 'text-muted'}`}>{fileSize(f.size)}</span> : null}
          </span>
          <FileArrowDownIcon size={16} aria-hidden="true" className="shrink-0 opacity-70" />
        </a>
      ))}
    </div>
  );
}
