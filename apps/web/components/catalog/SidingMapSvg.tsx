import type { Siding } from '@/lib/types';

/**
 * Stansiya shahobcha yo'llarining sxemasi (M1.3, F1 - MapLibre F2). Asosiy yo'l gorizontal,
 * shahobchalar navbat bilan yuqori/pastga; uzunlik √ masshtabda. Egasi tasdiqlangan - teal, aks holda kulrang.
 */
export function SidingMapSvg({ sidings, stationName }: { sidings: Siding[]; stationName: string }) {
  const list = sidings.slice(0, 14);
  const W = 720, H = 260, y0 = 130, x0 = 70, gap = (W - x0 - 40) / Math.max(list.length, 1);
  const maxLen = Math.max(...list.map((s) => s.lengthM ?? 100), 100);
  const len = (m: number | null) => 30 + 70 * Math.sqrt((m ?? 100) / maxLen);
  return (
    <figure className="rounded-card border border-line bg-white p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${stationName} stansiyasi shahobcha yo'llari sxemasi: ${list.length} ta yo'l`}>
        <line x1="10" y1={y0} x2={W - 10} y2={y0} stroke="#122A44" strokeWidth="4" />
        <line x1="10" y1={y0 + 7} x2={W - 10} y2={y0 + 7} stroke="#122A44" strokeWidth="2" opacity=".5" />
        <text x="14" y={y0 - 12} fontSize="12" fontFamily="JetBrains Mono, monospace" fill="#54677C">{stationName}, asosiy yo'l</text>
        {list.map((s, i) => {
          const up = i % 2 === 0, x = x0 + i * gap + gap / 2, L = len(s.lengthM), y1 = up ? y0 - L : y0 + L + 7;
          const c = s.claimStatus === 'APPROVED' ? '#0E9384' : s.claimStatus === 'PENDING' ? '#C77E1E' : '#8A9BAE';
          return (
            <g key={s.id}>
              <path d={`M${x - 24} ${up ? y0 : y0 + 7} Q${x} ${up ? y0 : y0 + 7} ${x} ${up ? y0 - 18 : y0 + 25} L${x} ${y1}`} fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" />
              <circle cx={x} cy={y1} r="4" fill={c} />
              <text x={x} y={up ? y1 - 8 : y1 + 16} fontSize="10" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fill="#10233B">№{s.registryNo} · {s.lengthM ?? '?'} m</text>
              <text x={x} y={up ? y1 - 20 : y1 + 28} fontSize="9" textAnchor="middle" fill="#54677C">{s.unloadCapacity}↓ {s.loadCapacity}↑ vag</text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-4 font-mono text-[11px] text-muted">
        <span><i className="inline-block h-2 w-2 rounded-full bg-teal" /> egasi tasdiqlangan</span>
        <span><i className="inline-block h-2 w-2 rounded-full bg-amber" /> tasdiq kutilmoqda</span>
        <span><i className="inline-block h-2 w-2 rounded-full bg-[#8A9BAE]" /> reestr (egasi yashirin)</span>
        {sidings.length > list.length ? <span>… yana {sidings.length - list.length} ta ro'yxatda</span> : null}
      </figcaption>
    </figure>
  );
}
