'use client';
/**
 * Jamoa: panelga kim kira oladi va qaysi darajada.
 *
 * Ega hammasini qiladi: sozlama, o'chirish va shu sahifa. Moderator faqat kundalik ish
 * qiladi va bu sahifani umuman ko'rmaydi (menyuda ham yo'q, server ham rad etadi),
 * shuning uchun o'ziga ega huquqini berib ololmaydi.
 *
 * Ikki qator tegilmaydi: o'zingiz (panelni qulflab qo'ymaslik uchun) va huquqi server
 * sozlamasidan kelgan odam (uni paneldan olib bo'lmaydi, qaytib kelaveradi).
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ShieldCheckIcon, UserIcon } from '@phosphor-icons/react';
import { api, post } from '@/lib/api';
import { uzDate } from '@/lib/format';
import { PhoneField, phoneDisplay } from '@/components/ui/fields';
import { BTN, BTN_DANGER, CARD, ConfirmButton, INPUT, Notice, PageHead, Pill, errText } from '@/components/admin/kit';

type Level = 'owner' | 'moderator';
type Member = { userId: string; fullName: string | null; phone: string | null; isActive: boolean; level: Level; fromEnv: boolean; since: string };
type Me = { id: string };

export default function TeamPage() {
  const t = useTranslations('admin.team');
  const tc = useTranslations('admin.common');
  const [rows, setRows] = useState<Member[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [add, setAdd] = useState<{ phone: string; level: Level }>({ phone: '', level: 'moderator' });

  const load = useCallback(async () => setRows(await api<Member[]>('/admin/team')), []);

  useEffect(() => {
    load().catch(() => { setRows([]); setMsg({ tone: 'err', text: tc('loadFailed') }); });
    api<Me>('/auth/me').then(setMe).catch(() => {});
  }, [load, tc]);

  /** Har amaldan keyin ro'yxat serverdan qayta o'qiladi: holatni taxmin qilmaymiz. */
  const run = async (fn: () => Promise<unknown>, okKey: string) => {
    setBusy(true); setMsg(null);
    try { await fn(); await load(); setMsg({ tone: 'ok', text: t(okKey) }); }
    catch (e) { setMsg({ tone: 'err', text: errText(e, (k) => t(k), (k) => t.has(k), tc('saveFailed')) }); }
    finally { setBusy(false); }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => { await post('/admin/team', { phone: add.phone.trim(), level: add.level }); setAdd({ phone: '', level: 'moderator' }); }, 'added');
  };

  return (
    <>
      <PageHead title={t('title')} lead={t('lead')} />

      <form onSubmit={submit} className={`${CARD} mt-4 flex flex-wrap items-end gap-3 p-4`}>
        <label className="grow basis-56 text-sm">
          <span className="font-mono text-[11px] text-muted">{t('phone')}</span>
          <PhoneField value={add.phone} onChange={(phone) => setAdd({ ...add, phone })} required className={`${INPUT} mt-1 font-mono`} />
        </label>
        <label className="basis-44 text-sm">
          <span className="font-mono text-[11px] text-muted">{t('level')}</span>
          <select value={add.level} onChange={(e) => setAdd({ ...add, level: e.target.value as Level })} className={`${INPUT} mt-1`}>
            <option value="moderator">{t('levels.moderator')}</option>
            <option value="owner">{t('levels.owner')}</option>
          </select>
        </label>
        <button type="submit" disabled={busy || !add.phone.trim()} className={BTN}>{busy ? tc('loading') : t('addCta')}</button>
        <p className="basis-full text-xs text-muted">{t('addHint')}</p>
      </form>

      {msg ? <div className="mt-3"><Notice tone={msg.tone}>{msg.text}</Notice></div> : null}

      <div className={`${CARD} mt-4 divide-y divide-line`}>
        {rows === null ? <p className="p-4 text-sm text-muted">{tc('loading')}</p>
          : rows.length === 0 ? <p className="p-4 text-sm text-muted">{t('empty')}</p>
          : rows.map((m) => {
            const self = me?.id === m.userId;
            const locked = self || m.fromEnv;
            return (
              <div key={m.userId} className="flex flex-wrap items-center gap-3 p-4">
                <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${m.level === 'owner' ? 'bg-navy text-white' : 'bg-sand text-muted'}`}>
                  {m.level === 'owner' ? <ShieldCheckIcon size={18} weight="fill" aria-hidden="true" /> : <UserIcon size={18} aria-hidden="true" />}
                </span>
                <div className="min-w-0 grow basis-52">
                  <p className="truncate font-semibold">{m.fullName || t('noName')}</p>
                  <p className="font-mono text-xs text-muted">{m.phone ? phoneDisplay(m.phone) : '-'} · {t('since', { date: uzDate(m.since) })}</p>
                </div>
                <Pill tone={m.level === 'owner' ? 'ok' : 'neutral'}>{t(`levels.${m.level}`)}</Pill>
                {self ? <Pill>{t('you')}</Pill> : null}
                {m.fromEnv && !self ? <Pill>{t('fromEnv')}</Pill> : null}
                {!m.isActive ? <Pill tone="warn">{t('blocked')}</Pill> : null}
                <div className="ml-auto flex shrink-0 flex-wrap gap-2">
                  {locked ? <span className="self-center text-xs text-muted">{t(self ? 'selfNote' : 'envNote')}</span> : (
                    <>
                      <button
                        type="button" disabled={busy}
                        onClick={() => void run(() => post(`/admin/team/${m.userId}`, { level: m.level === 'owner' ? 'moderator' : 'owner' }), 'changed')}
                        className={BTN}
                      >
                        {t(m.level === 'owner' ? 'toModerator' : 'toOwner')}
                      </button>
                      <ConfirmButton
                        label={t('remove')} confirm={tc('confirm')} disabled={busy}
                        onRun={() => run(() => api(`/admin/team/${m.userId}`, { method: 'DELETE' }), 'removed')}
                      />
                    </>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </>
  );
}
