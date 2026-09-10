import { Header } from '@/components/site/Header';
import { SessionGuard } from '@/components/kabinet/SessionGuard';

// Moderatsiya alohida maydon: oddiy foydalanuvchining kabineti bilan aralashmaydi,
// shuning uchun chap menyu yo'q. Kirish huquqini sahifaning o'zi tekshiradi.
export const metadata = { robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">{children}</div>
      <SessionGuard />
    </>
  );
}
