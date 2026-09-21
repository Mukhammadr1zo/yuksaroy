import { env } from '../../common/env';

/** Rekvizitlar env'da bo'lmasa: qo'lda to'lov, /contact orqali. */
const PAY_PLACEHOLDER = "To'lov rekvizitlari hali kiritilmagan. Buyurtma raqamini ko'rsatib /contact orqali yozing, to'lov tasdiqlangach xizmat yoqiladi.";

/**
 * Qo'lda to'lov ko'rsatmasi. Premium va obuna bir xil yo'l bilan to'lanadi, shuning
 * uchun matn bitta joyda: rekvizit o'zgarsa ikkalasida ham o'zgaradi.
 */
export function payInstructions() {
  return { method: 'manual' as const, details: env.PREMIUM_PAY_DETAILS ?? PAY_PLACEHOLDER };
}
