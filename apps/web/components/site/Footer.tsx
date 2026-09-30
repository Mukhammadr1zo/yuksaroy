import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Logo } from './Logo';

export async function Footer({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const [t, nav, tm, tp, tf, ta, tc, tb, n2, tad] = await Promise.all([
    getTranslations('footer'), getTranslations('nav'), getTranslations('marketing'),
    getTranslations('pricing'), getTranslations('features'), getTranslations('about'), getTranslations('contact'), getTranslations('blog'), getTranslations('nav2'), getTranslations('advertise'),
  ]);
  const dark = tone === 'dark';
  const muted = dark ? 'text-white/55' : 'text-muted';
  const hover = dark ? 'hover:text-white' : 'hover:text-navy';
  // Ustunlar: Katalog, Platforma (mahsulot), Kompaniya (biz haqimizda, blog)
  const platform = [
    ['/pricing', tp('eyebrow')], ['/features', tf('eyebrow')], ['/for-shippers', tm('footer.shippers')], ['/for-providers', tm('footer.providers')],
    ['/booking', tm('footer.booking')], ['/urgent', tf('items.urgent.title')],
    // Reklama beruvchi sayt bo'yicha havola izlaydi: shu ustunda, kirish tugmasidan oldin
    ['/advertise', tad('footer')], ['/login', t('platform.login')],
  ] as const;
  // Huquqiy havolalar shu ustunda: alohida ustun ochilsa futer to'rttadan beshtaga o'sib,
  // telefonda uzun ro'yxat bo'lardi, holbuki ikkita havola uchun yangi ustun keraksiz.
  const company = [
    ['/about', ta('eyebrow')], ['/contact', tc('eyebrow')], ['/blog', tb('eyebrow')],
    ['/terms', n2('terms')], ['/privacy', n2('privacy')],
  ] as const;
  return (
    <footer className={dark ? 'border-t border-white/10 bg-[#0A1626] text-white' : 'border-t border-line bg-white'}>
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div className="sm:col-span-2 lg:col-span-1">
          <Logo light={dark} />
          <p className={`mt-3 max-w-sm text-sm ${muted}`}>{t('tagline')}</p>
        </div>
        <div>
          <h3 className="text-sm font-bold">{t('catalog.heading')}</h3>
          <ul className={`mt-3 space-y-2 text-sm ${muted}`}>
            <li><Link className={hover} href="/terminals">{nav('terminals')}</Link></li>
            {/* SVX endi tur emas, xizmat: eski ?kind=SVX filtri jimgina e'tiborsiz qolardi */}
            <li><Link className={hover} href="/terminals?service=SVX">{t('catalog.customsWarehouses')}</Link></li>
            {/* Yangi bo'limlar: header bilan bir xil yorliqlar (nav2) */}
            <li><Link className={hover} href="/equipment">{n2('equipment')}</Link></li>
            <li><Link className={hover} href="/carriers">{n2('carriers')}</Link></li>
            <li><Link className={hover} href="/cargo">{n2('cargo')}</Link></li>
            <li><Link className={hover} href="/services">{n2('services')}</Link></li>
            <li><Link className={hover} href="/wagon">{n2('wagon')}</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-bold">{t('platform.heading')}</h3>
          <ul className={`mt-3 space-y-2 text-sm ${muted}`}>
            {platform.map(([href, label]) => <li key={href}><Link className={hover} href={href}>{label}</Link></li>)}
            {/* Bot kirish kodi uchun, kanal esa yangiliklar uchun: ikkalasi ham kerak */}
            <li><a className={hover} href="https://t.me/yuksaroy_bot" target="_blank" rel="noreferrer">{t('platform.telegramBot')}</a></li>
            <li><a className={hover} href="https://t.me/yuksaroy_uzbekistan" target="_blank" rel="noreferrer">{t('platform.telegramChannel')}</a></li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-bold">{ta('company')}</h3>
          <ul className={`mt-3 space-y-2 text-sm ${muted}`}>
            {company.map(([href, label]) => <li key={href}><Link className={hover} href={href}>{label}</Link></li>)}
          </ul>
        </div>
      </div>
      <div className={dark ? 'border-t border-white/10' : 'border-t border-line'}>
        <p className={`mx-auto max-w-6xl px-6 py-4 font-mono text-xs ${muted}`}>{t('legal', { year: new Date().getFullYear() })}</p>
      </div>
    </footer>
  );
}
