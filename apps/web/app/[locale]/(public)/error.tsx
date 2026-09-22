'use client';
// Bu guruhdagi kutilmagan xato: oq ekran yoki Next ning inglizcha sahifasi o'rniga
// o'z ekranimiz va qayta urinish tugmasi. Xato kodi 500 bo'lib qoladi: qidiruv tizimi
// uchun bu to'g'ri signal, aks holda buzilgan sahifa indeksga tushib qoladi.
import { ErrorBody } from '@/components/site/ErrorBody';

export default function GroupError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorBody error={error} reset={reset} />;
}
