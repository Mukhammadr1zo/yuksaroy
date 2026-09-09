import { LoginCard } from './LoginCard';

// ?next (proxy qo'yadi), ?attach=1 (telefonsiz Google hisobi) va ?reset=1 (parol tiklash) serverda o'qiladi: hydration farqi yo'q
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; attach?: string; reset?: string }> }) {
  const { next, attach, reset } = await searchParams;
  return <LoginCard next={next?.startsWith('/') ? next : null} attach={attach === '1'} reset={reset === '1'} />;
}
