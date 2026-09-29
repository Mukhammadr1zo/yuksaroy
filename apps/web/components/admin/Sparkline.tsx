/**
 * 30 kunlik chiziqcha: qo'lda SVG, kutubxona yo'q. Chiziq faqat tendensiya uchun (o'q va
 * to'r yo'q): son kartaning o'zida turadi, chiziq esa "ko'tarilyaptimi yoki tushyaptimi" deydi.
 *
 * preserveAspectRatio="none": karta kengligi qanday bo'lsa ham chiziq uni to'ldiradi.
 * Shu sababli oxirgi nuqta <circle> emas: cho'zilgan koordinatada doira ellipsga aylanardi.
 * Uning o'rniga nol uzunlikdagi yumaloq uchli chiziq, vector-effect bilan ekran masshtabida.
 * Oxirgi nuqta amber, chunki bugun hali to'liq emas: kechagidan past ko'rinishi tabiiy.
 */
export function Sparkline({ values, aria, empty }: { values: number[]; aria: string; empty: string }) {
  const max = Math.max(...values, 0);
  // Jami nol bo'lsa tekis chiziq hech nima demaydi: matn to'g'riroq
  if (!max) return <p className="mt-2 text-xs text-muted">{empty}</p>;
  const n = values.length;
  const step = n > 1 ? 120 / (n - 1) : 0;
  const pt = (v: number, i: number) => `${(i * step).toFixed(1)},${(30 - (v / max) * 28).toFixed(1)}`;
  const last = pt(values[n - 1]!, n - 1);
  return (
    <svg viewBox="0 0 120 32" preserveAspectRatio="none" role="img" aria-label={aria} className="mt-2 h-8 w-full overflow-visible">
      <title>{aria}</title>
      <polyline points={values.map(pt).join(' ')} fill="none" stroke="var(--color-teal)" strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <polyline points={`${last} ${last}`} fill="none" stroke="var(--color-amber)" strokeWidth={6} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
