import { Header } from '@/components/site/Header';
import { SessionGuard } from '@/components/kabinet/SessionGuard';
import { AdminShell } from '@/components/admin/AdminShell';

// Admin paneli: platformani boshqarish maydoni, oddiy kabinetdan alohida.
// Chap menyu AdminShell ichida, chunki u huquq tasdiqlangandan keyingina chiziladi.
export const metadata = { robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">
        <AdminShell>{children}</AdminShell>
      </div>
      <SessionGuard />
    </>
  );
}
