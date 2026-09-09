// Do'kon (/k/[slug]): sayt sarlavhasi va footer'siz toza mini sayt; sahifa o'zi "YukSaroy bilan" qatorini chizadi.
export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-sand">{children}</main>;
}
