'use client';
import { useEffect, useId, useRef, useState } from 'react';
import type { Station } from '@/lib/types';

export type StationPick = Pick<Station, 'id' | 'nameUz' | 'esrCode' | 'rju'>;

/**
 * Stansiya combobox: /api/v1/stations?q= (debounce 200 ms). Formada `name` bo'lsa yashirin input (GET filtr) qo'shadi.
 * Klaviatura: ↑ ↓ Enter Esc. WAI-ARIA combobox.
 */
const DEFAULT_INPUT = 'w-full rounded-xl border border-field bg-white px-4 py-3 outline-none focus:border-teal focus:ring-2 focus:ring-teal/25';

export function StationSearch({ value, onChange, name, placeholder = 'Stansiya nomi yoki ESR kodi', ariaLabel, autoFocus, inputClassName = DEFAULT_INPUT, hideCode }: {
  value: StationPick | null; onChange: (s: StationPick | null) => void; name?: string; placeholder?: string; ariaLabel?: string; autoFocus?: boolean; inputClassName?: string;
  /** Mini App: faqat stansiya nomi, ESR kodisiz */
  hideCode?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState(value?.nameUz ?? '');
  const [items, setItems] = useState<StationPick[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => { setText(value?.nameUz ?? ''); }, [value?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const q = text.trim();
    if (!open || q.length < 2 || q === value?.nameUz) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/v1/stations?q=${encodeURIComponent(q)}&limit=8`, { signal: ctl.signal });
        setItems(r.ok ? await r.json() : []); setActive(-1);
      } catch { /* bekor qilindi */ }
    }, 200);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [text, open, value?.nameUz]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const pick = (s: StationPick) => { onChange(s); setText(s.nameUz); setOpen(false); };

  return (
    <div ref={box} className="relative">
      {name && <input type="hidden" name={name} value={value?.id ?? ''} />}
      <input
        role="combobox" aria-expanded={open} aria-controls={`${id}-list`} aria-autocomplete="list" aria-label={ariaLabel ?? placeholder} aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined}
        className={inputClassName}
        placeholder={placeholder} value={text} autoFocus={autoFocus} autoComplete="off"
        onChange={(e) => { setText(e.target.value); setOpen(true); if (value) onChange(null); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, items.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === 'Enter' && open && active >= 0 && items[active]) { e.preventDefault(); pick(items[active]!); }
          else if (e.key === 'Escape') setOpen(false);
        }}
      />
      {value && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-teal-ink">{hideCode ? '✓' : value.esrCode ?? '✓'}</span>}
      {open && items.length > 0 && (
        <ul id={`${id}-list`} role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-line bg-white py-1 shadow-lg">
          {items.map((s, i) => (
            <li key={s.id} id={`${id}-${i}`} role="option" aria-selected={i === active}
              className={`flex cursor-pointer items-center justify-between px-4 py-2 text-sm ${i === active ? 'bg-teal-soft' : 'hover:bg-sand'}`}
              onMouseDown={(e) => { e.preventDefault(); pick(s); }} onMouseEnter={() => setActive(i)}>
              <span>{s.nameUz}</span>
              {hideCode ? null : <span className="font-mono text-xs text-muted">{s.esrCode ?? '·'} · {s.rju}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
