/**
 * Soat aniqligidagi yosh: "3 kun" / "5 soat" / "20 daqiqa". Kun bilan cheklanmaydi, chunki
 * bugun kelgan to'lov ham 6 soat kutgan bo'lishi mumkin. 3 kundan oshgan qizil, 1 kundan sariq.
 *
 * Bosh sahifadan ko'chirildi, chunki endi vazifa kartalari ham shu o'lchov bilan chiziladi
 * va ikki joyda ikki xil "eski" chegarasi bo'lmasligi kerak. Chegaralar (>= 3 kun bad,
 * >= 1 kun warn) contracts 4-bo'limda qat'iy: o'zgartirish bo'lsa shu yerda bitta.
 */
export type AgeTone = 'ok' | 'warn' | 'bad' | 'neutral';

export function ageOf(iso: string): { key: 'days' | 'hours' | 'minutes' | 'now'; n: number; tone: AgeTone } {
  const ms = Math.max(0, Date.now() - new Date(iso).getTime());
  const d = Math.floor(ms / 86_400_000);
  if (d >= 1) return { key: 'days', n: d, tone: d >= 3 ? 'bad' : 'warn' };
  const h = Math.floor(ms / 3_600_000);
  if (h >= 1) return { key: 'hours', n: h, tone: 'neutral' };
  const m = Math.floor(ms / 60_000);
  return m >= 1 ? { key: 'minutes', n: m, tone: 'neutral' } : { key: 'now', n: 0, tone: 'neutral' };
}
