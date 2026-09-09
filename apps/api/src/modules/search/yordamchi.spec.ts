import { describe, expect, it } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { REGIONS, SERVICE_CODES, parseQuery } from '@yuksaroy/domain';
import { SET_SEARCH_FILTERS, SYSTEM_PROMPT, Yordamchi, mergeFilters, needsLlm, sanitize } from './yordamchi';

const stub = (input: unknown, calls: unknown[] = []) =>
  ({ messages: { create: async (body: unknown) => { calls.push(body); return { content: [{ type: 'tool_use', id: 't1', name: 'set_search_filters', input }] }; } } }) as unknown as Anthropic;

describe('needsLlm', () => {
  it('ishonch past yoki tushunilmagan so\'z bo\'lsa true', () => {
    expect(needsLlm(parseQuery('Andijon'))).toBe(false);
    expect(needsLlm(parseQuery('asdf qwerty'))).toBe(true);
    expect(needsLlm(parseQuery("Samarqand bugun bo'sh slot"))).toBe(true); // "slot" tushunilmagan
  });
});

describe('sanitize', () => {
  it('faqat enumdagi qiymatlar; TRUCK -> kategoriya', () => {
    const s = sanitize({ category: 'nope', regions: ['UZ-AN', 'UZ-ZZ', 'UZ-AN'], corridor: { from: 'UZ-SU', to: 'UZ-SU' }, services: ['LOAD', 'X'], kind: 'YARD', qty: { wagons: 20, tonnes: -1, containers: 2.5 }, equipment: 'TRUCK', deal: 'RENT', bookable: 'yes' });
    expect(s).toEqual({ regions: ['UZ-AN'], services: ['LOAD'], kind: 'YARD', qty: { wagons: 20 }, category: 'truck', deal: 'RENT' });
    expect(sanitize(null)).toEqual({});
    expect(sanitize({ equipment: 'WAGON', bookable: true, corridor: { from: 'UZ-SU', to: 'UZ-TK' } })).toEqual({ equipment: 'WAGON', bookable: true, corridor: { from: 'UZ-SU', to: 'UZ-TK' } });
  });
});

describe('mergeFilters', () => {
  it('LLM faqat bo\'sh maydonlarni to\'ldiradi, ishonch max(lug\'at, 0.8), chiplar qayta quriladi', () => {
    const dict = parseQuery("Andijonda 20 vagonga shahobcha yo'l va manevr teplovozi"); // regions, qty, category, services bor
    const m = mergeFilters(dict, { regions: ['UZ-TK'], qty: { wagons: 5 }, category: 'terminal', kind: 'YARD', deal: 'RENT' });
    expect(m.regions).toEqual(['UZ-AN']);
    expect(m.qty).toEqual({ wagons: 20 });
    expect(m.category).toBe('siding');
    expect(m.kind).toBe('YARD');
    expect(m.deal).toBe('RENT');
    expect(m.confidence).toBe(1);
    expect(m.chips.map((c) => c.key)).toEqual(expect.arrayContaining(['region:UZ-AN', 'kind:YARD', 'deal:RENT']));
  });

  it('bo\'sh lug\'at natijasi: koridor viloyatlarni beradi, ishonch 0.8', () => {
    const dict = parseQuery('asdf qwerty');
    const m = mergeFilters(dict, { corridor: { from: 'UZ-SU', to: 'UZ-TK' }, services: ['UNLOAD'] });
    expect(m.corridor).toEqual({ from: 'UZ-SU', to: 'UZ-TK' });
    expect(m.regions).toEqual(['UZ-SU', 'UZ-QA', 'UZ-SA', 'UZ-JI', 'UZ-SI', 'UZ-TO', 'UZ-TK']);
    expect(m.confidence).toBe(0.8);
    expect(m.chips.map((c) => c.key)).toEqual(['corridor:UZ-SU>UZ-TK', 'service:UNLOAD']);
    expect(dict.chips).toEqual([]); // lug'at natijasi o'zgarmaydi
  });
});

describe('Yordamchi (SDK stub)', () => {
  it('asbob sxemasi SearchFilters enumlarini aks ettiradi va kesh belgisi bor', () => {
    const p = (SET_SEARCH_FILTERS.input_schema as { properties: Record<string, any> }).properties;
    expect(p.regions.items.enum).toEqual([...REGIONS]);
    expect(p.services.items.enum).toEqual([...SERVICE_CODES]);
    expect(SET_SEARCH_FILTERS.cache_control).toEqual({ type: 'ephemeral' });
    expect(SYSTEM_PROMPT.startsWith('Return only filters. Never invent objects, prices or availability. Regions must be from the enum.')).toBe(true);
  });

  it('ask: bitta asbob, tozalangan natija; so\'rov parametrlari kontraktga mos', async () => {
    const calls: any[] = [];
    const y = new Yordamchi(stub({ regions: ['UZ-FA'], services: ['LOAD', 'bad'] }, calls), 'test-model');
    expect(y.enabled).toBe(true);
    expect(await y.ask('Farg\'onada yuklash', 'uz')).toEqual({ regions: ['UZ-FA'], services: ['LOAD'] });
    expect(calls[0].model).toBe('test-model');
    expect(calls[0].max_tokens).toBe(512);
    expect(calls[0].tools).toHaveLength(1);
    expect(calls[0].tool_choice).toEqual({ type: 'tool', name: 'set_search_filters' });
    expect(calls[0].system[0].cache_control).toEqual({ type: 'ephemeral' });
  });

  it('xato yoki asbobsiz javob -> null; kalit yo\'q -> enabled false', async () => {
    const boom = { messages: { create: async () => { throw new Error('timeout'); } } } as unknown as Anthropic;
    expect(await new Yordamchi(boom, 'm').ask('x', 'uz')).toBeNull();
    const text = { messages: { create: async () => ({ content: [{ type: 'text', text: 'hi' }] }) } } as unknown as Anthropic;
    expect(await new Yordamchi(text, 'm').ask('x', 'uz')).toBeNull();
    expect(new Yordamchi(null, 'm').enabled).toBe(false);
  });

  it('kunlik chelak: mehmon va foydalanuvchi limitlari alohida', () => {
    const y = new Yordamchi(null, 'm');
    expect(y.limits.guest).toBeLessThan(y.limits.user);
    const t = Date.now();
    expect(y.take('g:1.1.1.1', 'guest', t)).toEqual({ ok: true, used: 1, limit: y.limits.guest });
    expect(y.take('u:abc', 'user', t)).toEqual({ ok: true, used: 1, limit: y.limits.user });
  });

  // Haqiqiy chaqiruv faqat .env da ANTHROPIC_API_KEY bo'lsa (bitta so'rov)
  it.skipIf(!process.env.ANTHROPIC_API_KEY)('haqiqiy Messages API: Termizdan Toshkentgacha', async () => {
    const r = await new Yordamchi().ask('Termizdan Toshkentgacha konteyner tushirish', 'uz');
    expect(r).not.toBeNull();
    expect(r!.corridor ?? r!.regions).toBeTruthy();
  }, 15_000);
});
