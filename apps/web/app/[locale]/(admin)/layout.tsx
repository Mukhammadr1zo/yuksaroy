import { SessionGuard } from '@/components/kabinet/SessionGuard';
import { AdminShell } from '@/components/admin/AdminShell';

// Admin paneli: platformani boshqarish maydoni, oddiy kabinetdan alohida.
// Sayt sarlavhasi (Header) bu yerda yo'q: yetti katalog havolasi panelda keraksiz va ~110px joy yerdi;
// til almashtirgich va chiqish menyusi AdminTopbar ga ko'chdi. Qobiq to'liq kenglikda, ichki main
// kengligini AdminShell o'zi cheklaydi (jadvallar 1400 da siqilardi).
export const metadata = { robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminShell>{children}</AdminShell>
      <SessionGuard />
    </>
  );
}
