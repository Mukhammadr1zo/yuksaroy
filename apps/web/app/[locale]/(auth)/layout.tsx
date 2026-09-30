import { getTranslations } from 'next-intl/server';
import { CalendarCheckIcon, MegaphoneIcon, TagIcon } from '@phosphor-icons/react/dist/ssr';
import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';

// Kirish va ro'yxat bir xil ikki ustun: chapda navy brend paneli, o'ngda oq karta (sahifa o'zi).
const BULLETS = [
  { key: 'tariffs', Icon: TagIcon },
  { key: 'booking', Icon: CalendarCheckIcon },
  { key: 'listing', Icon: MegaphoneIcon },
] as const;

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('auth2.brand');
  return (
    <>
      <Header />
      {/* Qadam almashganda bir marta kiradi: 220 ms, faqat holat o'zgarganda. reduced-motion global qoidaga bo'ysunadi */}
      <style>{'@keyframes ys-step{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}.ys-step{animation:ys-step 220ms cubic-bezier(.16,1,.3,1) both}'}</style>
      <main id="main" className="mx-auto grid max-w-6xl items-start gap-6 px-6 py-8 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:py-14">
        <section className="flex flex-col rounded-card bg-navy p-8 text-white lg:order-first lg:min-h-[560px] lg:p-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-teal-lit">{t('eyebrow')}</p>
          <h2 className="mt-3 font-display text-[clamp(1.5rem,2.6vw,2.2rem)] font-bold leading-[1.15]">{t('title')}</h2>
          <ul className="mt-8 space-y-5">
            {BULLETS.map(({ key, Icon }) => (
              <li key={key} className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5">
                  <Icon size={22} weight="duotone" className="text-teal-lit" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold">{t(`bullets.${key}.title`)}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-white/65">{t(`bullets.${key}.body`)}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-10 border-t border-white/10 pt-5 text-sm text-white/55 lg:mt-auto">{t('note')}</p>
        </section>
        <div className="order-first lg:order-none">{children}</div>
      </main>
      <Footer />
    </>
  );
}
