'use client';
// Parol + takror. onChange faqat yetarli uzun va mos parolni beradi, aks holda null (tugma o'chiq qoladi).
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PASSWORD } from '@yuksaroy/domain';
import { PasswordField } from '@/components/ui/fields';
import { input } from './styles';

// ponytail: kuchlilik = uzunlik + belgi turlari soni; zxcvbn kerak bo'lsa keyin
const strength = (p: string) => {
  if (p.length < PASSWORD.minLength) return 0;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^\w]/].filter((r) => r.test(p)).length;
  return kinds >= 3 || (kinds >= 2 && p.length >= 12) ? 3 : kinds >= 2 ? 2 : 1;
};
const BAR = ['', 'bg-red-500', 'bg-amber', 'bg-teal'];
const LABEL = ['', 'weak', 'fair', 'strong'] as const;

export function PasswordFields({ onChange, autoFocus }: { onChange: (password: string | null) => void; autoFocus?: boolean }) {
  const t = useTranslations('auth2.password');
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const s = strength(pw);
  const mismatch = confirm.length > 0 && confirm !== pw;
  const set = (p: string, c: string) => { setPw(p); setConfirm(c); onChange(p.length >= PASSWORD.minLength && p === c ? p : null); };

  return (
    <div className="space-y-4">
      <label className="block text-sm font-semibold">{t('label')}
        <PasswordField className={input} value={pw} onChange={(e) => set(e.target.value, confirm)}
          autoComplete="new-password" minLength={PASSWORD.minLength} maxLength={200} required autoFocus={autoFocus} />
        <span className="mt-2 flex items-center gap-3 text-xs font-normal text-muted" aria-live="polite">
          <span className="flex h-1 flex-1 gap-1" aria-hidden="true">
            {[1, 2, 3].map((i) => <span key={i} className={`flex-1 rounded-full transition-colors duration-200 ${s >= i ? BAR[s] : 'bg-line'}`} />)}
          </span>
          <span className="shrink-0">{s ? t(`strength.${LABEL[s]}`) : t('min', { min: PASSWORD.minLength })}</span>
        </span>
      </label>
      <label className="block text-sm font-semibold">{t('confirm')}
        <PasswordField className={`${input} ${mismatch ? 'border-red-500' : ''}`} value={confirm} onChange={(e) => set(pw, e.target.value)}
          autoComplete="new-password" minLength={PASSWORD.minLength} maxLength={200} required aria-invalid={mismatch || undefined} />
        {mismatch && <span className="mt-1 block text-xs font-normal text-red-700">{t('mismatch')}</span>}
      </label>
    </div>
  );
}
