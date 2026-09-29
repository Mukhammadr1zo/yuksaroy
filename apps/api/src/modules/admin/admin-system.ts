/**
 * Tizim sahifasining ikki chegarasi, sof. Ekran (web) xuddi shu chegaralar bilan chizadi;
 * web da test yo'q (loyiha odati), shuning uchun raqamlar shu yerda spec bilan qotiriladi.
 * ponytail: API javobida ohang yo'q (SystemInfo faqat son), bu funksiyalar chegaraning manbai.
 */
export type Tone = 'ok' | 'warn' | 'bad';

/** Vagon manbasi: xato yarmidan ko'p bo'lsa bad, bitta bo'lsa ham warn, xato yo'q (yoki qidiruv yo'q) ok. */
export const wagonTone = (errors: number, total: number): Tone => (errors <= 0 ? 'ok' : errors >= total / 2 ? 'bad' : 'warn');

/** Kunlik sikl 26 soatdan eski: to'xtagan. Hali yugurmagan (null) alohida holat, u eski emas. */
export const STALE_DAILY_MS = 26 * 3_600_000;
export const staleDaily = (at: Date | null | undefined, now: Date): boolean => !!at && now.getTime() - at.getTime() > STALE_DAILY_MS;
