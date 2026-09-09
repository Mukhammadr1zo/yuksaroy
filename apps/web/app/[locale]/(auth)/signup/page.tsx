import { RegisterFlow } from './RegisterFlow';

export default async function RoyxatPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <RegisterFlow next={next?.startsWith('/') ? next : null} />;
}
