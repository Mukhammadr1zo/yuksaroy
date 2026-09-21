import { describe, expect, it } from 'vitest';
import { HelpLlm } from './help.llm';

// Soxta mijoz: so'rovni eslab qoladi, berilgan javobni qaytaradi
function fake(res: Record<string, unknown>) {
  const calls: Record<string, unknown>[] = [];
  const client = { messages: { create: async (params: Record<string, unknown>) => { calls.push(params); return res; } } };
  return { llm: new HelpLlm(client as never, 'test-model'), calls };
}
const text = (t: string) => [{ type: 'text', text: t }];

describe('HelpLlm.ask', () => {
  it('fikrlash o\'chiq va javob qisqa chegarada', async () => {
    const { llm, calls } = fake({ stop_reason: 'end_turn', content: text('Ha, bepul.') });
    await expect(llm.ask('bepulmi', 'uz')).resolves.toBe('Ha, bepul.');
    expect(calls[0].thinking).toEqual({ type: 'disabled' });
    expect(calls[0].max_tokens).toBeLessThanOrEqual(400);
  });

  it('kesilgan (max_tokens) yoki rad etilgan javob null', async () => {
    const cut = fake({ stop_reason: 'max_tokens', content: text('Katalog, xarita va solish') });
    await expect(cut.llm.ask('q', 'uz')).resolves.toBeNull();
    const ref = fake({ stop_reason: 'refusal', content: text('') });
    await expect(ref.llm.ask('q', 'uz')).resolves.toBeNull();
  });

  it('kalit yo\'q yoki xato: null', async () => {
    await expect(new HelpLlm(null).ask('q', 'ru')).resolves.toBeNull();
    const boom = { messages: { create: async () => { throw new Error('timeout'); } } };
    await expect(new HelpLlm(boom as never).ask('q', 'en')).resolves.toBeNull();
  });
});
