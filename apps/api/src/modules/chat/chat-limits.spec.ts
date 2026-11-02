// Bir odam bir soatda eng ko'pi 30 yangi yozishma va 120 xabar (2026-11-02, egasining sukut qiymati).
import { describe, expect, it } from 'vitest';
import { MESSAGES_PER_HOUR, NEW_CHATS_PER_HOUR, takeMessage, takeNewChat } from './chat-limits';

const limited = (fn: () => void) => { try { fn(); } catch (e) { return (e as { getStatus(): number; getResponse(): unknown }); } return null; };

describe('yozishma chegaralari', () => {
  it("31-yangi yozishma 429 CHAT_LIMIT, boshqa odam ta'sirlanmaydi", () => {
    for (let i = 0; i < NEW_CHATS_PER_HOUR; i++) expect(limited(() => takeNewChat('lim-a'))).toBeNull();
    const e = limited(() => takeNewChat('lim-a'));
    expect(e?.getStatus()).toBe(429);
    expect(e?.getResponse()).toMatchObject({ code: 'CHAT_LIMIT' });
    expect(limited(() => takeNewChat('lim-b'))).toBeNull();
  });

  it('121-xabar rad etiladi, yangi yozishma chelagi alohida', () => {
    for (let i = 0; i < MESSAGES_PER_HOUR; i++) expect(limited(() => takeMessage('lim-c'))).toBeNull();
    expect(limited(() => takeMessage('lim-c'))?.getStatus()).toBe(429);
    expect(limited(() => takeNewChat('lim-c'))).toBeNull();
  });
});
