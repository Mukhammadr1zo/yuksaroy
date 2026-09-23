'use client';
// Umumiy forma maydonlari: telefon (davlat kodi + raqam maskasi) va parol (ko'rsatish tugmasi).
// Ikkalasi ham auth, kabinet va Mini App da bir xil ishlaydi.
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { CaretDownIcon, EyeIcon, EyeSlashIcon, MagnifyingGlassIcon } from '@phosphor-icons/react';
import { COUNTRIES, OTHER, countryName, dialOf, splitPhone } from '@/lib/countries';

const UZ_NAT = 9; // +998 dan keyingi raqamlar soni (operator kodi + raqam)
const E164_MAX = 15; // davlat kodi bilan birga eng uzun raqam

/**
 * Milliy qism guruhlanadi. O'zbekiston uchun odatiy 90 123 45 67, qolganlar uchun
 * uchtadan: har davlatning o'z qoidasi bor va noto'g'ri maska raqamni buzib ko'rsatardi.
 */
function groupNational(iso: string, d: string) {
  if (!d) return '';
  if (iso === 'UZ') return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ');
  // Qozog'iston va Rossiya (+7) alohida: ular eng ko'p uchraydigan chet el kodi va
  // uchtadan guruhlash oxirida yolg'iz raqam qoldirib, notanish ko'rinish berardi
  if (dialOf(iso) === '7') return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean).join(' ');
  return (d.match(/.{1,3}/g) ?? []).join(' ');
}

/** Milliy qismga sig'adigan raqamlar soni: E.164 chegarasidan davlat kodi ayiriladi. */
const natMax = (iso: string) => (iso === 'UZ' ? UZ_NAT : E164_MAX - dialOf(iso).length);

/** Ekranda ko'rsatish uchun to'liq shakl: "+998 90 123 45 67". */
export function phoneDisplay(v: string) {
  const digits = v.replace(/\D/g, '');
  if (!digits) return '';
  const { iso, national } = splitPhone(v);
  if (iso === OTHER) return `+${digits}`;
  return `+${dialOf(iso)} ${groupNational(iso, national)}`.trim();
}

/** Yangi matnda `n` ta raqamdan keyingi kursor joyi. */
function caretFor(display: string, n: number) {
  if (!display || n <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < display.length; i++) {
    if (/\d/.test(display[i]!) && ++seen === n) return i + 1;
  }
  return display.length;
}

/**
 * Davlat tanlagich. Native select emas: u brauzerning o'z oynasini ochadi va
 * loyihaning dizayn tizimidan tashqarida qoladi; bu yerda StationSearch naqshi.
 */
function CountryPicker({ iso, onPick, disabled }: { iso: string; onPick: (iso: string) => void; disabled?: boolean }) {
  const t = useTranslations('auth.phone');
  const locale = useLocale();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  // Ro'yxat sahifaning tanasiga chiqariladi: forma animatsiyasi transform bilan yangi
  // qatlam yasaydi va oddiy joylashtirilgan ro'yxat o'sha qatlam ichida qolib,
  // yonidagi tugmalar ostiga tushib ketardi. Joyi tugmaning o'lchamidan olinadi.
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);

  const place = () => {
    const r = box.current?.getBoundingClientRect();
    if (r) setAt({ top: r.bottom + 4, left: r.left });
  };

  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!box.current?.contains(t) && !panel.current?.contains(t)) setOpen(false);
    };
    // Ro'yxatning O'ZI aylantirilsa yopilmaydi: hodisa ushlash bosqichida keladi va
    // shartsiz yopish ro'yxatni birinchi aylantirishdayoq yopib qo'yardi
    const onScroll = (e: Event) => { if (!panel.current?.contains(e.target as Node)) setOpen(false); };
    const close = () => setOpen(false);
    document.addEventListener('mousedown', outside);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    search.current?.focus();
    return () => {
      document.removeEventListener('mousedown', outside);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  // Qidiruv nom bo'yicha ham, kod bo'yicha ham ishlaydi: odam "Qozog" ham, "7" ham yozadi
  const named = useMemo(() => COUNTRIES.map((c) => ({ ...c, name: countryName(c.iso, locale) })), [locale]);
  const shown = useMemo(() => {
    const s = q.trim().replace(/^\+/, '').toLowerCase();
    if (!s) return named;
    return named.filter((c) => c.dial.startsWith(s) || c.name.toLowerCase().includes(s) || c.iso.toLowerCase() === s);
  }, [named, q]);

  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-label={t('country')}
        onClick={() => { if (!open) place(); setOpen((v) => !v); }}
        className="flex h-full items-center gap-1 rounded-xl border border-line bg-white px-3 font-mono text-sm text-navy outline-none transition-colors duration-150 hover:border-teal focus:border-teal focus:ring-2 focus:ring-teal/25 disabled:bg-sand"
      >
        {iso === OTHER ? '+' : `+${dialOf(iso)}`}
        <CaretDownIcon size={12} weight="bold" className="text-muted" aria-hidden="true" />
      </button>
      {open && at ? createPortal(
        <div ref={panel} style={{ top: at.top, left: at.left }} className="fixed z-[80] w-72 max-w-[85vw] rounded-xl border border-line bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <MagnifyingGlassIcon size={16} className="shrink-0 text-muted" aria-hidden="true" />
            <input
              ref={search} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search')} aria-label={t('search')}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted/70"
              onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setOpen(false); } }}
            />
          </div>
          <ul id={id} role="listbox" aria-label={t('country')} className="max-h-64 overflow-auto py-1">
            {shown.map((c) => (
              <li key={c.iso}>
                <button
                  type="button" role="option" aria-selected={c.iso === iso}
                  onClick={() => { onPick(c.iso); setOpen(false); setQ(''); }}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${c.iso === iso ? 'bg-teal-soft' : 'hover:bg-sand'}`}
                >
                  <span className="min-w-0 truncate">{c.name}</span>
                  <span className="shrink-0 font-mono text-xs text-muted">+{c.dial}</span>
                </button>
              </li>
            ))}
            {/* Ro'yxatda yo'q davlat: kodni odam o'zi yozadi, ya'ni hech kim to'silib qolmaydi */}
            <li>
              <button
                type="button" role="option" aria-selected={iso === OTHER}
                onClick={() => { onPick(OTHER); setOpen(false); setQ(''); }}
                className={`w-full border-t border-line px-3 py-2 text-left text-sm ${iso === OTHER ? 'bg-teal-soft' : 'hover:bg-sand'}`}
              >
                {t('other')}
              </button>
            </li>
          </ul>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

type PhoneProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  'aria-label'?: string;
};

/**
 * Telefon maydoni: chapda davlat kodi, o'ngda raqamning o'zi.
 *
 * Nega tanlagich: platforma import, eksport va tranzitni ham qamraydi, ya'ni yuk egasi
 * ham, tashuvchi ham chet eldan bo'lishi mumkin. Ilgari maydon faqat +998 ni qabul
 * qilardi va chet ellik odam hisob ocholmasdi.
 *
 * Qiymat ota komponentda doim E.164 shaklida turadi ("+998901234567"), ekranda esa
 * davlat kodi tugmada, milliy qism maydonda ajratilgan holda ko'rinadi.
 */
export function PhoneField({ value, onChange, className = '', placeholder, disabled, ...rest }: PhoneProps) {
  const t = useTranslations('auth.phone');
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  // Tanlangan davlat qiymatdan o'qiladi, lekin o'zi ham saqlanadi: raqam bo'sh bo'lsa
  // qiymatdan davlatni bilib bo'lmaydi va tanlov yo'qolib ketardi
  const [iso, setIso] = useState(() => splitPhone(value).iso);

  const digits = value.replace(/\D/g, '');
  const dial = iso === OTHER ? '' : dialOf(iso);
  const national = iso === OTHER ? digits : digits.startsWith(dial) ? digits.slice(dial.length) : digits;
  const text = iso === OTHER ? national : groupNational(iso, national.slice(0, natMax(iso)));

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && caret.current !== null) { el.setSelectionRange(caret.current, caret.current); caret.current = null; }
  });

  const write = (nat: string, digitsBefore: number) => {
    const cut = nat.slice(0, iso === OTHER ? E164_MAX : natMax(iso));
    caret.current = caretFor(iso === OTHER ? cut : groupNational(iso, cut), digitsBefore);
    onChange(cut ? `+${dial}${cut}` : '');
  };

  const pick = (next: string) => {
    setIso(next);
    const cut = national.slice(0, next === OTHER ? E164_MAX : natMax(next));
    onChange(cut ? `+${next === OTHER ? '' : dialOf(next)}${cut}` : '');
    ref.current?.focus();
  };

  return (
    <div className="flex items-stretch gap-2">
      <CountryPicker iso={iso} onPick={pick} disabled={disabled} />
      <input
        {...rest}
        ref={ref}
        disabled={disabled}
        className={`${className} min-w-0 flex-1`}
        // Chet el tanlanganda O'zbekiston namunasi ko'rsatilmaydi: u raqam shaklini
        // noto'g'ri o'rgatardi
        placeholder={iso === 'UZ' ? (placeholder ?? '90 123 45 67') : t('numberPlaceholder')}
        value={text}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        onChange={(e) => {
          const raw = e.target.value;
          const pos = e.target.selectionStart ?? raw.length;
          write(raw.replace(/\D/g, ''), (raw.slice(0, pos).match(/\d/g) ?? []).length);
        }}
        onKeyDown={(e) => {
          // Ajratgich ustida Backspace bosilsa oldingi raqam o'chsin, aks holda maydon qotib qolgandek tuyuladi
          const el = e.currentTarget;
          if (e.key !== 'Backspace' || el.selectionStart !== el.selectionEnd) return;
          const c = el.selectionStart ?? 0;
          if (c === 0 || /\d/.test(el.value[c - 1] ?? '')) return;
          let i = c - 1;
          while (i > 0 && !/\d/.test(el.value[i - 1] ?? '')) i--;
          if (i === 0) return;
          e.preventDefault();
          const next = el.value.slice(0, i - 1) + el.value.slice(c);
          write(next.replace(/\D/g, ''), (next.slice(0, i - 1).match(/\d/g) ?? []).length);
        }}
      />
    </div>
  );
}

type PasswordProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

/** Parol maydoni: yozilganini ko'rish uchun ko'z tugmasi. */
export function PasswordField({ className = '', ...rest }: PasswordProps) {
  const t = useTranslations('auth2.password');
  const [show, setShow] = useState(false);
  // mt-* klassi konteynerga o'tadi: tugma inputning o'rtasida tursin, tepadagi bo'shliqda emas
  const mt = className.match(/(?:^|\s)(mt-[^\s]+)/)?.[1] ?? '';
  const inner = mt ? className.replace(mt, '') : className;
  return (
    <span className={`relative block ${mt}`}>
      <input {...rest} type={show ? 'text' : 'password'} className={`${inner} pr-12`} />
      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label={t(show ? 'hide' : 'show')}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-muted transition-colors duration-150 hover:text-navy"
      >
        {show ? <EyeSlashIcon size={20} aria-hidden="true" /> : <EyeIcon size={20} aria-hidden="true" />}
      </button>
    </span>
  );
}
