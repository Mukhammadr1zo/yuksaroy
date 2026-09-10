import { Header } from '@/components/site/Header';
import { CompareTray } from '@/components/compare/CompareTray';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="min-h-[70vh]">{children}</main>
      {/* Solishtirish savati: tanlov bo'lsa pastda suzadi, bo'lmasa hech narsa */}
      <CompareTray />
    </>
  );
}
