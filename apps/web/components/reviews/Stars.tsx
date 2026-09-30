/**
 * 1..5 yulduz: to'lganlari to'la shakl, qolgani ochiq shakl. Server va mijozda ishlaydi.
 *
 * Nega ikki xil shakl, faqat rang emas: rangi ko'rinmaydigan odam uchun to'la va bo'sh
 * yulduz bir xil bo'lib qolardi. Rang qo'shimcha kanal, ma'noni shakl tashiydi.
 * role="img" ham kerak: aria-label yolg'iz span'da ekran o'quvchiga yetmaydi.
 */
export function Stars({ n, className = 'text-sm' }: { n: number; className?: string }) {
  return (
    <span role="img" aria-label={`${n}/5`} className={`font-mono tracking-tight ${className}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} aria-hidden="true" className={i <= n ? 'text-amber-ink' : 'text-line'}>{i <= n ? '★' : '☆'}</span>
      ))}
    </span>
  );
}
