import type { Metadata } from 'next';
import Script from 'next/script';
import { TgProvider } from '@/components/tg/TgProvider';
import '@/components/tg/tg.css';

// Telegram Mini App qobig'i: Header va Footer yo'q, Telegram SDK gidratsiyadan oldin, barcha /tg sahifalari noindex.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function TgLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js?59" strategy="beforeInteractive" />
      <TgProvider>{children}</TgProvider>
    </>
  );
}
