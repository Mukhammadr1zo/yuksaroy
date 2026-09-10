'use client';
// Umumiy forma maydonlari: telefon (raqam maskasi) va parol (ko'rsatish tugmasi).
// Ikkalasi ham auth, kabinet va Mini App da bir xil ishlaydi.
import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { EyeIcon, EyeSlashIcon } from '@phosphor-icons/react';

const NAT = 9; // +998 dan keyingi raqamlar soni (operator kodi + raqam)

/**
 * Faqat raqamlar qoladi. Maydonda matn doim +998 bilan boshlanadi, shuning uchun prefiks
 * shu belgiga qarab kesiladi: aks holda 99 operator kodi (+998 99 ...) prefiks deb o'qilardi.
 */
function phoneDigits(v: string) {
  const t = v.replace(/[^\d+]/g, '');
  if (t.startsWith('+998')) return t.slice(4).replace(/\D/g, '').slice(0, NAT);
  let d = t.replace(/\D/g, '');
  if (d.length > NAT && d.startsWith('998')) d = d.slice(3);
  return d.slice(0, NAT);
}

/** Ekranda: +998 90 123 45 67 */
export function phoneDisplay(v: string) {
  const d = phoneDigits(v);
  if (!d) return '';
  return ['+998', d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ');
}

/** Tashqariga E.164: +998901234567 (API normalizeUzPhone shu shaklni kutadi). */
const phoneValue = (v: string) => {
  const d = phoneDigits(v);
  return d ? `+998${d}` : '';
};

// Yarim raqam bilan forma yuborilmasin: brauzer o'zi to'xtatadi
const PATTERN = '\\+998 \\d{2} \\d{3} \\d{2} \\d{2}';

/** Yangi matnda milliy raqamlardan `nat` tasidan keyingi joy (998 hisobga olinmaydi). */
function caretFor(display: string, nat: number) {
  if (!display) return 0;
  let seen = 0;
  for (let i = 0; i < display.length; i++) {
    if (/\d/.test(display[i]!) && ++seen === 3 + nat) return i + 1;
  }
  return display.length;
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
 * Telefon maydoni: harf yozib bo'lmaydi, raqamlar yozilgan sayin ajraladi.
 * Qiymat ota komponentda E.164 shaklida turadi, ekranda esa maskalanadi.
 */
export function PhoneField({ value, onChange, className = '', placeholder = '+998 90 123 45 67', ...rest }: PhoneProps) {
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);

  // Qiymat qayta formatlangach kursor o'z joyida qolsin (o'rtaga yozganda oxiriga sakramasin)
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && caret.current !== null) { el.setSelectionRange(caret.current, caret.current); caret.current = null; }
  });

  const commit = (raw: string, caretPos: number) => {
    // phoneDigits bilan bir xil qoida: 998 prefiks bo'lsa kursor hisobida ham uch raqam tashlanadi
    const t = raw.replace(/[^\d+]/g, '');
    const all = t.replace(/\D/g, '');
    const prefixed = t.startsWith('+998') || (all.length > NAT && all.startsWith('998'));
    const before = (raw.slice(0, caretPos).match(/\d/g) ?? []).length;
    caret.current = caretFor(phoneDisplay(raw), Math.max(0, prefixed ? before - 3 : before));
    onChange(phoneValue(raw));
  };

  return (
    <input
      {...rest}
      ref={ref}
      className={className}
      placeholder={placeholder}
      value={phoneDisplay(value)}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      pattern={PATTERN}
      onChange={(e) => commit(e.target.value, e.target.selectionStart ?? e.target.value.length)}
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
        commit(el.value.slice(0, i - 1) + el.value.slice(c), i - 1);
      }}
    />
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
