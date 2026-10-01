'use client';
import { useEffect, useId, useRef, useState } from 'react';
import type { CargoType } from '@/lib/types';

export type CargoPick = Pick<CargoType, 'code' | 'name' | 'groupCode' | 'groupName'>;

/** ETSNG pozitsiya combobox: /api/v1/cargo-types?q= (nom, guruh yoki kod). */
const DEFAULT_INPUT = 'w-full rounded-xl border border-field bg-white px-4 py-3 outline-none focus:border-teal focus:ring-2 focus:ring-teal/25';

export function CargoSearch({ value, onChange, placeholder = 'Yuk turi (ETSNG): sement, bug\'doy, 281000…', ariaLabel, inputClassName = DEFAULT_INPUT }: { value: CargoPick | null; onChange: (c: CargoPick | null) => void; placeholder?: string; ariaLabel?: string; inputClassName?: string }) {
  const id = useId();
  const [text, setText] = useState(value ? value.name : '');
  const [items, setItems] = useState<CargoPick[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = text.trim();
    if (!open || q.length < 2 || q === value?.name) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/v1/cargo-types?q=${encodeURIComponent(q)}&limit=8`, { signal: ctl.signal });
        setItems(r.ok ? await r.json() : []); setActive(-1);
      } catch { /* bekor qilindi */ }
    }, 200);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [text, open, value?.name]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const pick = (c: CargoPick) => { onChange(c); setText(c.name); setOpen(false); };

  return (
    <div ref={box} className="relative">
      <input
        role="combobox" aria-expanded={open} aria-controls={`${id}-list`} aria-autocomplete="list" aria-label={ariaLabel ?? placeholder}
        aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined}
        className={`${inputClassName ?? ''}${value ? ' pr-16' : ''}`}
        placeholder={placeholder} value={text} autoComplete="off"
        onChange={(e) => { setText(e.target.value); setOpen(true); if (value) onChange(null); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, items.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === 'Enter' && open && active >= 0 && items[active]) { e.preventDefault(); pick(items[active]!); }
          else if (e.key === 'Escape') setOpen(false);
        }}
      />
      {value && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-teal-ink">{value.code}</span>}
      {open && items.length > 0 && (
        <ul id={`${id}-list`} role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-line bg-white py-1 shadow-lg">
          {items.map((c, i) => (
            <li key={c.code} id={`${id}-${i}`} role="option" aria-selected={i === active}
              className={`cursor-pointer px-4 py-2 text-sm ${i === active ? 'bg-teal-soft' : 'hover:bg-sand'}`}
              onMouseDown={(e) => { e.preventDefault(); pick(c); }} onMouseEnter={() => setActive(i)}>
              <span className="font-mono text-xs text-muted">{c.code}</span> {c.name}
              <span className="block text-xs text-muted">{c.groupName}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
