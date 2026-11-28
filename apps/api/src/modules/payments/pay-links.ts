/**
 * Qaysi to'lov tizimlari yoqilgan va buyurtma uchun to'lov havolalari.
 * Tizim faqat hamma kaliti .env da bo'lsa yoqiladi; bittasi ham yo'q bo'lsa karta avvalgidek
 * qo'lda to'lov (rekvizit) ko'rsatadi va sinov muddati taklif qilinadi.
 */
import { env } from '../../common/env';

export const payme = () => (env.PAYME_MERCHANT_ID && env.PAYME_KEY ? { merchantId: env.PAYME_MERCHANT_ID, key: env.PAYME_KEY, login: env.PAYME_LOGIN ?? 'Paycom', test: env.PAYME_TEST === '1' } : null);
export const click = () => (env.CLICK_SERVICE_ID && env.CLICK_MERCHANT_ID && env.CLICK_SECRET_KEY ? { serviceId: env.CLICK_SERVICE_ID, merchantId: env.CLICK_MERCHANT_ID, secret: env.CLICK_SECRET_KEY } : null);
export const uzum = () => (env.UZUM_SERVICE_ID && env.UZUM_LOGIN && env.UZUM_PASSWORD ? { serviceId: env.UZUM_SERVICE_ID, login: env.UZUM_LOGIN, password: env.UZUM_PASSWORD } : null);

/** Kamida bitta online to'lov tizimi ulanganmi. */
export const onlinePayOn = () => !!(payme() || click() || uzum());

export type PayLinks = { payme?: string; click?: string; uzum?: { serviceId: string; account: string; url: string } };

/**
 * Buyurtma uchun havolalar. Qaytish manzili kabinetdagi obuna sahifasi: to'lovdan keyin
 * karta yangi holatni (faol obuna) o'zi ko'rsatadi.
 */
export function payLinks(order: { no: string; amountTiyin: bigint }): PayLinks {
  const back = `${env.WEB_ORIGIN}/dashboard/subscription`;
  const out: PayLinks = {};
  const p = payme();
  if (p) {
    const params = `m=${p.merchantId};ac.order_id=${order.no};a=${order.amountTiyin};c=${back};l=uz`;
    out.payme = `${p.test ? 'https://test.paycom.uz' : 'https://checkout.paycom.uz'}/${Buffer.from(params).toString('base64')}`;
  }
  const c = click();
  if (c) {
    const q = new URLSearchParams({
      service_id: c.serviceId, merchant_id: c.merchantId,
      amount: (Number(order.amountTiyin) / 100).toFixed(2), transaction_param: order.no, return_url: back,
    });
    out.click = `https://my.click.uz/services/pay?${q}`;
  }
  const u = uzum();
  /*
   * Uzum Bank: ilovani xizmat sahifasida ochadigan havola (rasmiy spetsifikatsiyada yo'q, lekin
   * keng ishlatiladi; kalit nomi `account` Uzum xizmatni sozlaganda kelishilgan nom bilan bir xil
   * bo'lishi shart). Ishlamasa mijoz ilovada xizmatni topib, buyurtma raqamini o'zi kiritadi.
   */
  if (u) {
    const q = new URLSearchParams({ serviceId: u.serviceId, amount: String(order.amountTiyin), account: order.no, redirectUrl: back });
    out.uzum = { serviceId: u.serviceId, account: order.no, url: `https://www.uzumbank.uz/open-service?${q}` };
  }
  return out;
}
