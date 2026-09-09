import { useTranslations } from 'next-intl';

/** GET forma select'i (terminallar sahifasidagi bilan bir xil ko'rinish), JS kerak emas. */
export function Sel({ name, value, label, aria, options }: { name: string; value: string; label?: string; /** Ekran o'quvchi uchun nom; berilmasa label, saralashda a11y.sort */ aria?: string; options: (readonly [string, string])[] }) {
  const t = useTranslations('a11y');
  // ponytail: saralash select'ining nomi hamma sahifada bir xil, shuning uchun shu yerda; boshqa nom kerak bo'lsa aria prop
  return (
    <select name={name} defaultValue={value} aria-label={aria ?? (name === 'sort' ? t('sort') : label ?? name)} className="w-full rounded-xl border border-line bg-white px-3 py-3 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/25">
      {label ? <option value="">{label}</option> : null}
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
