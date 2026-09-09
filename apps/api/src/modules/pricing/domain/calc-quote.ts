// Narx hisobi - sof funksiya. Pul: tiyin, butun son. Framework yo'q.
import type { Operation, ServiceCode, TariffUnit } from '@yuksaroy/domain';

export interface QuoteTariff { id: string; serviceCode: ServiceCode; cargoGroupCode: string | null; priceTiyin: number; unit: TariffUnit; minTiyin: number | null }
export interface QuoteInput {
  operation: Operation;
  weightKg: number;
  wagonCount?: number;
  storageDays?: number;
  services?: ServiceCode[];
  cargoGroupCode?: string | null;
}
export interface QuoteConfig { commissionPct: number; commissionPayer: 'TERMINAL' | 'CLIENT' }
export interface QuoteLine { serviceCode: ServiceCode; tariffId: string; unit: TariffUnit; qty: number; unitPriceTiyin: number; amountTiyin: number; minApplied: boolean }
export interface Quote {
  lines: QuoteLine[];
  /** So'ralgan, lekin terminalda tarifi yo'q xizmatlar - mijozga «alohida kelishiladi». */
  missing: ServiceCode[];
  subtotalTiyin: number;
  commissionPct: number;
  commissionPayer: 'TERMINAL' | 'CLIENT';
  commissionTiyin: number;
  /** Mijoz to'laydigan summa: payer=CLIENT bo'lsa komissiya qo'shiladi. */
  totalTiyin: number;
}

/** Yuk guruhiga mos tarif ustun; bo'lmasa umumiy (cargoGroupCode = null). */
export function pickTariff(tariffs: QuoteTariff[], code: ServiceCode, cargoGroupCode: string | null | undefined): QuoteTariff | null {
  const same = tariffs.filter((t) => t.serviceCode === code);
  return (cargoGroupCode && same.find((t) => t.cargoGroupCode === cargoGroupCode)) || same.find((t) => t.cargoGroupCode === null) || null;
}

export function qtyFor(unit: TariffUnit, i: QuoteInput): number {
  switch (unit) {
    case 'PER_TON': return Math.round(i.weightKg) / 1000;
    case 'PER_WAGON': return Math.max(1, Math.round(i.wagonCount ?? 1));
    case 'PER_DAY': return Math.max(1, Math.round(i.storageDays ?? 1));
    case 'PER_OPERATION': return 1;
  }
}

export function calcQuote(i: QuoteInput, tariffs: QuoteTariff[], cfg: QuoteConfig): Quote {
  const wanted: ServiceCode[] = [i.operation, ...(i.services ?? []).filter((s) => s !== i.operation)];
  const lines: QuoteLine[] = [];
  const missing: ServiceCode[] = [];
  for (const code of wanted) {
    const t = pickTariff(tariffs, code, i.cargoGroupCode);
    if (!t) { missing.push(code); continue; }
    const qty = qtyFor(t.unit, i);
    let amount = Math.round(t.priceTiyin * qty);
    const minApplied = t.minTiyin !== null && amount < t.minTiyin;
    if (minApplied) amount = t.minTiyin!;
    lines.push({ serviceCode: code, tariffId: t.id, unit: t.unit, qty, unitPriceTiyin: t.priceTiyin, amountTiyin: amount, minApplied });
  }
  const subtotalTiyin = lines.reduce((s, l) => s + l.amountTiyin, 0);
  const commissionTiyin = Math.round((subtotalTiyin * cfg.commissionPct) / 10_000);
  return {
    lines, missing, subtotalTiyin, commissionPct: cfg.commissionPct, commissionPayer: cfg.commissionPayer, commissionTiyin,
    totalTiyin: cfg.commissionPayer === 'CLIENT' ? subtotalTiyin + commissionTiyin : subtotalTiyin,
  };
}
