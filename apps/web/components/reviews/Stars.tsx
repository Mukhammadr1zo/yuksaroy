/** 1..5 yulduz: to'lganlari amber, qolgani chiziq rangida. Server va mijozda ishlaydi. */
export function Stars({ n, className = 'text-sm' }: { n: number; className?: string }) {
  return (
    <span aria-label={`${n}/5`} className={`font-mono tracking-tight ${className}`}>
      {[1, 2, 3, 4, 5].map((i) => <span key={i} aria-hidden="true" className={i <= n ? 'text-amber' : 'text-line'}>★</span>)}
    </span>
  );
}
