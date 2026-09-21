import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../common/env';
import { FAQ, type HelpLang } from './faq';

const LANG_NAME: Record<HelpLang, string> = { uz: 'Uzbek (Latin script)', ru: 'Russian', en: 'English' };

/**
 * Tizim ko'rsatmasi til bo'yicha bir marta quriladi va o'zgarmaydi: cache_control
 * shu o'zgarmas matnga qo'yiladi, har so'rovda faqat savol yangi.
 */
const SYSTEM: Partial<Record<HelpLang, string>> = {};
export function systemPrompt(lang: HelpLang): string {
  return (SYSTEM[lang] ??= [
    'You are the help assistant of YukSaroy, a freight logistics marketplace in Uzbekistan (terminals and rail sidings, railway equipment, trucks, cargo board, services centre, wagon search).',
    `Answer ONLY from the FAQ below. Answer in ${LANG_NAME[lang]} in 1 to 3 short sentences, plain words a first-time visitor understands, no jargon, no markdown, no lists.`,
    'If the FAQ does not cover the question, say in one sentence that you do not know and that the person can write via the /contact page.',
    'Never invent prices, phone numbers, limits, dates or features. Do not quote site paths except /contact.',
    '',
    'FAQ:',
    ...FAQ[lang].map((f) => `Q: ${f.q}\nA: ${f.a}`),
  ].join('\n'));
}

/**
 * LLM javobi: kalit bo'lsa Messages API (8 s, qayta urinishsiz, past effort); har qanday xatoda null.
 * Kunlik chelaklar kontrollerda: bu sinf faqat so'raydi.
 */
export class HelpLlm {
  constructor(
    private readonly client: Pick<Anthropic, 'messages'> | null = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null,
    private readonly model = env.YORDAMCHI_MODEL ?? 'claude-sonnet-5',
  ) {}

  get enabled(): boolean { return this.client !== null; }

  async ask(q: string, lang: HelpLang): Promise<string | null> {
    if (!this.client) return null;
    try {
      const res = await this.client.messages.create({
        model: this.model,
        max_tokens: 300,
        output_config: { effort: 'low' }, // qisqa javob, fikrlash chuqurligi shart emas; 8 s ichida ulgurishi kerak
        system: [{ type: 'text', text: systemPrompt(lang), cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: q }],
      }, { timeout: 8000, maxRetries: 0 });
      if (res.stop_reason === 'refusal') return null;
      const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join(' ').trim();
      return text || null;
    } catch (e) {
      console.warn('help llm:', e instanceof Error ? e.message : e);
      return null;
    }
  }
}
