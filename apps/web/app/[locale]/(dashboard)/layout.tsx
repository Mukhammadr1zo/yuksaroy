import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { SideNav } from '@/components/kabinet/SideNav';
import { SessionGuard } from '@/components/kabinet/SessionGuard';

// Kabinet alohida qobiq emas: sayt sarlavhasi va futeri shu yerda ham turadi, foydalanuvchi
// bir bosishda katalogga qaytadi. Chap menyu faqat ish sahifalarida.
export const metadata = { robots: { index: false, follow: false } };

export default function KabinetLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[190px_minmax(0,1fr)] lg:py-8">
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start"><SideNav /></aside>
        <main className="min-w-0">{children}</main>
      </div>
      <SessionGuard />
      <Footer />
    </>
  );
}
