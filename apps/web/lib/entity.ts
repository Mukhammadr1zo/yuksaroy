// Tashkilotning rasmiy rekvizitlari. BITTA MANBA: futer, murojaat sahifasi, biz haqimizda
// sahifasi va qidiruv tizimi uchun Organization sxemasi hammasi shu fayldan oladi.
//
// EGASI UCHUN: qiymatni faqat shu yerga yozing, boshqa hech qayerga yozish kerak emas.
// Bo'sh qoldirilgan maydon HECH QAYERDA chiqmaydi: na futerda, na sahifalarda, na sxemada.
// Hammasi bo'sh bo'lsa butun blok umuman chizilmaydi. Nega: bo'sh ramka yoki yorlig'i bor
// lekin qiymati yo'q qator sahifani buzadi va "hali to'ldirilmagan" degan taassurot qoldiradi.
//
// Nega tarjima faylida emas: bu qiymatlar uch tilda bir xil, uch tilda saqlansa bittasi
// eskirib qolardi. Yorliqlar esa (Manzil, Telefon va boshqalar) messages/*/entity.json da.

/** Rekvizitlar. Tartibi shu yerdagidek chiqadi: birinchi nom, keyin STIR, manzil, aloqa. */
export const ENTITY = {
  /** Tashkilotning ro'yxatdan o'tgan to'liq nomi, hujjatda qanday yozilgan bo'lsa shundayligicha. */
  legalName: '',
  /** Soliq to'lovchining identifikatsiya raqami (STIR), faqat raqamlar. */
  tin: '',
  /** Yuridik manzil bitta satrda: viloyat, shahar, ko'cha, uy. */
  address: '',
  /** Ommaviy telefon xalqaro shaklda (+ belgisi bilan). tel: havolasi shundan tuziladi. */
  phone: '',
  /** Ommaviy pochta manzili. mailto: havolasi shundan tuziladi. */
  email: '',
  /** Ish vaqti odam o'qiydigan ko'rinishda: kunlar va soatlar. */
  hours: '',
};

export type EntityField = keyof typeof ENTITY;

/**
 * To'ldirilgan maydonlar juftlik ro'yxati sifatida, yuqoridagi tartibda. Bo'shlari tashlanadi.
 * Chaqiruvchi uzunligini tekshirib blokni butunlay tashlab ketishi mumkin.
 */
export const entityRows = (): { key: EntityField; value: string }[] =>
  (Object.entries(ENTITY) as [EntityField, string][])
    .filter(([, v]) => v.trim() !== '')
    .map(([key, value]) => ({ key, value: value.trim() }));
