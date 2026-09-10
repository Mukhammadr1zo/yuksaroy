import { Link } from '@/i18n/navigation';
import { KabinetNav } from '@/components/order/KabinetNav';
import { SessionGuard } from '@/components/kabinet/SessionGuard';

// Kabinet indekslanmaydi (proxy kirmaganni /login ga yuboradi, robots.txt da ham yopiq)
export const metadata = { robots: { index: false, follow: false } };

export default function KabinetLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-sand">
      <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
          <Link href="/" className="font-display text-lg font-bold tracking-tight">YukSaroy</Link>
          <KabinetNav />
          <SessionGuard />
        </div>
      </header>
      {children}
    </div>
  );
}
