'use client';
// Rasm yuklash: har fayl POST /uploads (multipart) -> URL. Ketma-ket yuklanadi, xato bo'lsa qolganlari davom etadi.
import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LISTING } from '@yuksaroy/domain';
import { authHeaders } from '@/lib/api';

const ACCEPT = 'image/jpeg,image/png,image/webp';

export type Uploaded = { url: string; name: string; size: number; mime: string };

export async function uploadOne(file: File, retry = true): Promise<{ url?: string; file?: Uploaded; code?: string }> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/v1/uploads', { method: 'POST', body: fd, credentials: 'include', headers: authHeaders() }); // Mini App'da Bearer
  if (res.status === 401 && retry) {
    const r = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: '{}' });
    if (r.ok) return uploadOne(file, false);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) return { code: body?.code ?? 'UPLOAD' };
  // Nom va o'lcham yozishmada kerak: hujjatning o'zi ko'rinmaydi, faqat nomi bilan tanaladi
  return { url: body?.url, file: { url: body?.url, name: body?.name ?? file.name, size: body?.size ?? file.size, mime: body?.mime ?? file.type } };
}

export function PhotoUpload({ photos, onChange, max = LISTING.maxPhotos, error }: { photos: string[]; onChange: (p: string[]) => void; max?: number; error?: string }) {
  const t = useTranslations('kabinet.form');
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setErr(null);
    const list = Array.from(files).slice(0, Math.max(0, max - photos.length));
    if (list.length < files.length) setErr(t('err.TOO_MANY'));
    const urls: string[] = [];
    setBusy(list.length);
    for (const f of list) {
      try {
        const r = await uploadOne(f);
        if (r.url) urls.push(r.url);
        else setErr(t.has(`err.${r.code}`) ? t(`err.${r.code}`) : t('err.UPLOAD'));
      } catch { setErr(t('err.UPLOAD')); } finally { setBusy((n) => n - 1); }
    }
    if (urls.length) onChange([...photos, ...urls]);
    if (input.current) input.current.value = '';
  }

  const full = photos.length >= max;
  return (
    <div>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {photos.map((url, i) => (
          <li key={url} className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-line bg-sand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button" aria-label={t('remove')} onClick={() => onChange(photos.filter((_, j) => j !== i))}
              className="tap-40 absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-xs font-semibold text-red-700 shadow-sm ring-1 ring-line"
            >
              x
            </button>
          </li>
        ))}
        {!full ? (
          <li>
            <button
              type="button" disabled={busy > 0} onClick={() => input.current?.click()}
              className="flex aspect-[4/3] w-full items-center justify-center rounded-xl border border-dashed border-line bg-white text-sm font-semibold text-muted transition hover:border-teal hover:text-teal-ink disabled:opacity-60"
            >
              {busy > 0 ? `${t('photoUploading')} ${busy}` : t('photoAdd')}
            </button>
          </li>
        ) : null}
      </ul>
      <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={(e) => void pick(e.target.files)} />
      <p className="mt-1 font-mono text-xs text-muted">{photos.length} / {max}</p>
      {error || err ? <p role="alert" className="mt-1 text-xs font-semibold text-red-700">{error ?? err}</p> : null}
    </div>
  );
}
