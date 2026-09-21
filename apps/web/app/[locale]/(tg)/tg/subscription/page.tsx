'use client';
// Telegram Mini App ichida obuna: kabinet cookie'si bu yerda yo'q, tashqi brauzerda ochilsa odam
// kirish oynasiga tushardi. Karta bitta, sessiyani api() o'zi (Bearer) biladi.
import { SubscriptionCard } from '@/components/subscription/SubscriptionCard';

export default function TgSubscriptionPage() {
  return (
    <main className="mx-auto max-w-md px-4 pb-8 pt-4">
      <SubscriptionCard />
    </main>
  );
}
