import Anthropic from '@anthropic-ai/sdk';
import {
  DEAL_KINDS, LISTING_KINDS, REGIONS, SEARCH_CATEGORIES, SEARCH_LABELS, SERVICE_CODES, TERMINAL_KINDS, YORDAMCHI, corridorRegions,
  type DealKind, type EquipmentKind, type RegionCode, type SearchChip, type SearchFilters, type SearchLang, type ServiceCode, type TerminalKind,
} from '@yuksaroy/domain';
import { env } from '../../common/env';
import { DailyBucket } from '../../common/ip-bucket';

/** LLM to'ldiradigan qism: SearchFilters ning enum maydonlari. `near` yo'q: koordinata o'ylab topilmasin. */
export type LlmFilters = Partial<Pick<SearchFilters, 'category' | 'regions' | 'corridor' | 'services' | 'kind' | 'qty' | 'equipment' | 'deal' | 'bookable'>>;
const LLM_KEYS = ['category', 'regions', 'corridor', 'services', 'kind', 'qty', 'equipment', 'deal', 'bookable'] as const;

const enumOf = (values: readonly string[], description: string) => ({ type: 'string', enum: [...values], description });
const REGION_ENUM = { type: 'string', enum: [...REGIONS] };

/** Bitta asbob: model faqat filtrlarni qaytaradi. Sxema SearchFilters kontraktini aks ettiradi. */
export const SET_SEARCH_FILTERS: Anthropic.Tool = {
  name: 'set_search_filters',
  description: 'Set the structured search filters extracted from the user query. Include only fields the query clearly states.',
  input_schema: {
    type: 'object',
    properties: {
      category: enumOf(SEARCH_CATEGORIES, 'terminal = freight yard or terminal services; siding = private rail siding; equipment = rail equipment to rent or buy; truck = road transport'),
      regions: { type: 'array', items: REGION_ENUM, description: 'Regions of Uzbekistan mentioned (codes from the enum only)' },
      corridor: { type: 'object', properties: { from: REGION_ENUM, to: REGION_ENUM }, required: ['from', 'to'], description: 'Route from one region to another ("from X to Y")' },
      services: { type: 'array', items: enumOf(SERVICE_CODES, 'Terminal service'), description: 'Terminal services requested' },
      kind: enumOf(TERMINAL_KINDS, 'Terminal kind'),
      qty: { type: 'object', properties: { wagons: { type: 'integer' }, tonnes: { type: 'integer' }, containers: { type: 'integer' } }, description: 'Quantities stated in the query' },
      equipment: enumOf(LISTING_KINDS, 'Equipment kind (TRUCK means road transport)'),
      deal: enumOf(DEAL_KINDS, 'RENT or SALE'),
      bookable: { type: 'boolean', description: 'true only if the user wants a free slot today or right now' },
    },
    additionalProperties: false,
  },
  cache_control: { type: 'ephemeral' },
};

const legend = (rows: Record<string, string>[], codes: readonly string[]) =>
  codes.map((c) => `${c}: ${rows.map((r) => r[c]).join(' / ')}`).join('\n');
const LANGS: SearchLang[] = ['uz', 'ru', 'en'];
const L = LANGS.map((l) => SEARCH_LABELS[l]);

/** Tizim ko'rsatmasi: qat'iy va o'zgarmas (kesh uchun); lug'at uch tilda. */
export const SYSTEM_PROMPT = [
  'Return only filters. Never invent objects, prices or availability. Regions must be from the enum.',
  'The query is a freight logistics search in Uzbekistan (Uzbek Latin or Cyrillic, Russian or English). Map place names to region codes.',
  'Regions:', legend(L.map((x) => x.region), REGIONS),
  'Services:', legend(L.map((x) => x.service), SERVICE_CODES),
  'Terminal kinds:', legend(L.map((x) => x.kind), TERMINAL_KINDS),
  'Equipment:', legend(L.map((x) => x.equipment), ['SHUNTING_LOCO', 'WAGON']) + '\nTRUCK: yuk mashinasi, fura / фура, грузовик / truck',
].join('\n');

/** LLM ishlatiladimi: lug'at ishonchi past yoki tushunilmagan so'z qolgan. */
export const needsLlm = (f: SearchFilters): boolean => f.confidence < YORDAMCHI.llmThreshold || f.unresolved.length > 0;

const inList = <T extends string>(v: unknown, list: readonly T[]): v is T => typeof v === 'string' && (list as readonly string[]).includes(v);
const listOf = <T extends string>(v: unknown, list: readonly T[]): T[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is T => inList(x, list)))] : []);
const posInt = (v: unknown): number | undefined => (typeof v === 'number' && Number.isInteger(v) && v > 0 && v < 100_000 ? v : undefined);

/** Model javobini tozalash: faqat enumdagi qiymatlar; TRUCK texnika emas, kategoriya. */
export function sanitize(input: unknown): LlmFilters {
  const i = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const out: LlmFilters = {};
  if (inList(i.category, SEARCH_CATEGORIES)) out.category = i.category;
  const regions = listOf(i.regions, REGIONS);
  if (regions.length) out.regions = regions;
  const c = i.corridor as Record<string, unknown> | undefined;
  if (c && inList(c.from, REGIONS) && inList(c.to, REGIONS) && c.from !== c.to) out.corridor = { from: c.from as RegionCode, to: c.to as RegionCode };
  const services = listOf(i.services, SERVICE_CODES);
  if (services.length) out.services = services as ServiceCode[];
  if (inList(i.kind, TERMINAL_KINDS)) out.kind = i.kind as TerminalKind;
  const q = i.qty as Record<string, unknown> | undefined;
  if (q) {
    const qty: NonNullable<SearchFilters['qty']> = {};
    for (const u of ['wagons', 'tonnes', 'containers'] as const) { const n = posInt(q[u]); if (n) qty[u] = n; }
    if (Object.keys(qty).length) out.qty = qty;
  }
  if (i.equipment === 'TRUCK') out.category ??= 'truck';
  else if (inList(i.equipment, LISTING_KINDS)) out.equipment = i.equipment as EquipmentKind;
  if (inList(i.deal, DEAL_KINDS)) out.deal = i.deal as DealKind;
  if (i.bookable === true) out.bookable = true;
  return out;
}

const isEmpty = (v: unknown) => v == null || (Array.isArray(v) && v.length === 0);

// ponytail: domain buildChips eksport qilinmagan; shu nusxa u bilan bir xil, eksport qilinsa o'chadi
function chipsOf(f: SearchFilters): SearchChip[] {
  const chips: SearchChip[] = [];
  const chip = (type: SearchChip['type'], value: string) => chips.push({ key: `${type}:${value}`, type, value });
  if (f.category) chip('category', f.category);
  if (f.corridor) chip('corridor', `${f.corridor.from}>${f.corridor.to}`);
  else for (const r of f.regions) chip('region', r);
  if (f.near) chip('near', String(f.near.radiusKm));
  for (const s of f.services) chip('service', s);
  if (f.kind) chip('kind', f.kind);
  if (f.qty) for (const [k, v] of Object.entries(f.qty)) chip('qty', `${k}=${v}`);
  if (f.equipment) chip('equipment', f.equipment);
  if (f.deal) chip('deal', f.deal);
  if (f.bookable) chip('bookable', '1');
  return chips;
}

/** Birlashtirish: LLM faqat lug'atda bo'sh qolgan maydonlarni to'ldiradi; ishonch max(lug'at, 0.8). */
export function mergeFilters(dict: SearchFilters, llm: LlmFilters): SearchFilters {
  const f: SearchFilters = { ...dict };
  for (const k of LLM_KEYS) if (isEmpty(dict[k]) && !isEmpty(llm[k])) Object.assign(f, { [k]: llm[k] });
  if (f.corridor && !dict.corridor && dict.regions.length === 0) f.regions = corridorRegions(f.corridor.from, f.corridor.to);
  f.confidence = Math.max(dict.confidence, 0.8);
  f.chips = chipsOf(f);
  return f;
}

/**
 * Yordamchi LLM: kalit bo'lsa Messages API (bitta asbob, kesh, 8 s, qayta urinishsiz); har qanday xatoda null.
 * Kunlik chelaklar shu yerda (userId yoki ip bo'yicha, Toshkent yarim tuni).
 */
export class Yordamchi {
  private readonly daily = new DailyBucket();
  readonly limits = { guest: env.YORDAMCHI_GUEST_DAILY ?? YORDAMCHI.guestDaily, user: env.YORDAMCHI_USER_DAILY ?? YORDAMCHI.userDaily };

  constructor(
    private readonly client: Pick<Anthropic, 'messages'> | null = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null,
    private readonly model = env.YORDAMCHI_MODEL ?? 'claude-sonnet-5',
  ) {}

  get enabled(): boolean { return this.client !== null; }

  take(key: string, who: 'guest' | 'user', now = Date.now()) { return this.daily.take(key, this.limits[who], now); }

  async ask(q: string, lang: SearchLang): Promise<LlmFilters | null> {
    if (!this.client) return null;
    try {
      const res = await this.client.messages.create({
        model: this.model,
        max_tokens: YORDAMCHI.maxTokens,
        thinking: { type: 'disabled' }, // ponytail: ajratish uchun fikrlash shart emas, 512 token asbob chaqiruviga ketadi
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        tools: [SET_SEARCH_FILTERS],
        tool_choice: { type: 'tool', name: SET_SEARCH_FILTERS.name },
        messages: [{ role: 'user', content: `lang=${lang}\n${q}` }],
      }, { timeout: YORDAMCHI.timeoutMs, maxRetries: 0 });
      const use = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === SET_SEARCH_FILTERS.name);
      return use ? sanitize(use.input) : null;
    } catch (e) {
      console.warn('yordamchi llm:', e instanceof Error ? e.message : e);
      return null;
    }
  }
}
