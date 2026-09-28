/**
 * Reestrdan kelgan obyekt egasining turi.
 *
 * Nega kerak: katalogda ~1700 qator bor va ularning bir qismi bozorga umuman
 * chiqmaydigan egalarga tegishli: harbiy qism, jazoni ijro etish muassasasi, temir
 * yo'lning o'z bo'linmalari (ПЧ, ПМС, ВЧД, lokomotiv depolari), davlat korxonalari va
 * yirik davlat sanoati (NGMK, AGMK, Uzmetkombinat, TES). Bular hech qachon e'lon
 * bermaydi va hech kim ularga yuk topshirmaydi, ya'ni katalogda faqat shovqin.
 *
 * Nega huquqiy shaklning o'zi yetarli emas: "faqat MChJ va OOO qolsin" degan qoida
 * ChP, ChL, SP, OK, fermer xo'jaligi va jismoniy shaxsni ham o'chirib tashlaydi, ular
 * esa aynan kerakli mijoz. Teskarisi ham to'g'ri: "neft bazasi" nomi ham davlat
 * ombori, ham xususiy MChJ bo'ladi; "Navoiy" esa ko'pincha shaharning nomi, NGMK ning
 * emas. Shuning uchun qoida shunday: xususiy huquqiy shakl BOR bo'lsa qator qoladi,
 * faqat harbiy va nomi bilan tanilgan davlat giganti bundan mustasno.
 *
 * Ro'yxatlar shu yerda turadi, chunki ular ikki joyda kerak: bazadagi filtr
 * (contains shartlari shu bo'laklardan quriladi) va ekrandagi belgi.
 *
 * DIQQAT: bu qoida hukm chiqarmaydi, faqat qatorlarni bitta ekranga yig'adi. Nomdan
 * egani aniqlash 100 foiz aniq bo'lmaydi, shuning uchun o'chirish yoki yashirish
 * oldidan operator ro'yxatni o'z ko'zi bilan ko'radi.
 */
export const OWNER_KINDS = ['harbiy', 'temiryul', 'davlat', 'gigant', 'xususiy'] as const;
export type OwnerKind = (typeof OWNER_KINDS)[number];

/**
 * Harbiy, mudofaa va jazoni ijro etish muassasalari. Huquqiy shakli nima bo'lsa ham chiqariladi.
 *
 * Jazoni ijro etish muassasasi shu ro'yxatda, davlat korxonalari ro'yxatida emas: u yerda
 * xususiy huquqiy shakl qatorni saqlab qolardi, ya'ni "... МЧЖ" deb yozilgan koloniya
 * katalogda qolib ketardi.
 *
 * Yozilishlar prodda ko'rilgan haqiqiy qatorlardan: lotincha ham, kirillcha ham,
 * "воинская" ham, "войсковая" ham uchraydi.
 */
const HARBIY = [
  'харбий', 'ҳарбий', 'harbiy', 'xarbiy',
  'воинск', 'войсков', 'воен', 'в/ч', 'в/част',
  'мудофа', 'Мудофаа', 'МО РУ',
  // Bo'sh joy bilan: "кеч" o'zbekcha so'zning ham ichida uchraydi
  ' КЭЧ', ' КЕЧ',
  'қўшинлар',
  'топогео',
  'ХУЖФК',
  'уй-жойдан фойдаланиш', 'уй жойдан фойдаланиш',
  // Jazoni ijro etish
  'колони', 'koloniya', 'kolonia',
  'жазони ижро', 'jazoni ijro', 'jazoni-ijro',
  'ИЧК', 'УЯ-',
  'қамоқ', 'qamoq', 'турма', 'тюрьм',
] as const;

/** Temir yo'lning o'z bo'linmalari: nomida huquqiy shakl bo'lmaydi. */
const TEMIRYUL = [
  'ПЧ-', 'ПЧ ', 'ПМС', 'ОПМС', 'ВЧД', 'ШЧ ', 'ЭЧ-', 'ЭЧК', 'ПДМ-',
  'депо', 'depo',
  'масофа', 'дистанц',
  'путевая', 'ПУТЕВАЯ',
  'Рельсосвар', 'Мостоотр',
  'Темирйўлёнилғи', 'Темирйулёнилги', "TEMIRYO'LYONGI",
  'вагонларни буғл', "vagonlarni bug",
  'Темирйўлкарго', "TEMIRYO'LKARGO",
] as const;

/** Davlat korxonalari, muassasalari va jazoni ijro etish muassasalari. */
const DAVLAT = [
  'ДУК', 'ДУП', 'ГУП',
  'ДП ', "ДП'", 'ГП ', "ГП'", 'ДОП ',
  'УП ', ' УК ', ' ДМ', ' ДК', ' DK',
  'РДЭУП', 'ЭЛУП',
  'давлат муассаса', 'шўба корх',
  'бошқарма', 'бошкарма',
  'унитар', 'unitar',
] as const;

/** Nomi bilan tanilgan davlat sanoati. Shakli AJ yoki DK bo'ladi, shuning uchun ustun turadi. */
const GIGANT = [
  'НГМК', 'NGMK', 'НКМК',
  'АГМК', 'AGMK', 'Алмалыкский',
  'кон-металл', 'kon-metall', 'рудабош', 'Рудоуправ',
  'Узмет', 'Узбекнефт',
  'ТЭС', 'ТЦ-',
  'азот', 'АЗОТ',
  // Bo'sh joy bilan: busiz "Buran" kabi xususiy nom ham gigant bo'lib qolardi
  ' УРАН',
  'НГРЭ', 'НГҚЧБ', 'ГҚИЗ',
  'газ қазиб',
  'ҳудудгаз', 'Худудгаз', 'hududgaz', 'HUDUDGAZ', 'Hududgaz',
  'газ таъминот', "gaz ta'minot", "GAZ TA'MINOT",
  'иссиклик марказ',
  'Агрокимёхимоя', 'Агрокимехимоя', 'Агрокимёҳимоя', 'AGROKIMYOHIMOYA', 'Agrokimyohimoya',
] as const;

/**
 * Xususiy huquqiy shakllar. Bittasi topilsa qator bozorga tegishli deb hisoblanadi.
 *
 * Qisqa qisqartmalar oldida bo'sh joy bilan yoziladi. Sababi tekshiruvda chiqdi:
 * bo'sh joysiz "ШК" so'zning ichiga tushadi va "Ta-SHK-ent" ni ham tutib oladi.
 * Shu tuzoq uzun ro'yxatda ko'rinmaydi, shuning uchun har qisqartma shu qoidada.
 */
const XUSUSIY = [
  'МЧЖ', 'MCHJ', 'MChJ', 'МChJ', 'МCHJ', 'MCHj',
  'масъулияти', 'маъсулияти',
  'ООО', 'OOO',
  'ЧП', 'ЧЛ', 'ЧФ',
  ' ХК', 'Х.К', ' XK', 'хусусий корх', 'xususiy korx', ' ХТ',
  'СП ', "СП'",
  'ОК ', "ОК'", 'оилавий',
  'фермер', 'fermer', ' ФХ', ' FX',
  'ЯТТ', 'YATT',
  'ЖШ ', "ЖШ'", 'жисмоний', 'jismoniy shaxs', 'Фуқаро', 'Фукоро',
  'ширкат', ' ШК',
  'LTD', 'Ltd', 'Pte',
  'МПЧФ', 'ПКФ', 'ПФК',
] as const;

/**
 * Toifa uchun qaysi bo'laklar izlanadi va qaysilari bo'lmasligi kerak.
 *
 * Bazadagi filtr shu ikki ro'yxatdan quriladi: any -> OR(contains), none -> NOT OR(contains).
 * Shu tarzda filtr, tartib va sahifalash bazada qoladi.
 */
export const OWNER_MATCH: Record<OwnerKind, { any: readonly string[]; none: readonly string[] }> = {
  harbiy: { any: HARBIY, none: [] },
  gigant: { any: GIGANT, none: [] },
  // Xususiy shakl bor bo'lsa chiqarilmaydi: "AZIZBEK TEMIR YO'L TA'MIR QURILISH" MChJ
  // temir yo'lda ishlaydigan xususiy pudratchi, temir yo'lning bo'linmasi emas
  temiryul: { any: TEMIRYUL, none: [...XUSUSIY, ...HARBIY, ...GIGANT] },
  davlat: { any: DAVLAT, none: [...XUSUSIY, ...HARBIY, ...GIGANT] },
  xususiy: { any: XUSUSIY, none: [...HARBIY, ...GIGANT] },
};

const hasAny = (low: string, words: readonly string[]) => words.some((w) => low.includes(w.toLowerCase()));

/** Bitta matn bo'yicha toifa. */
function kindOfText(text: string | null | undefined): OwnerKind | null {
  if (!text) return null;
  const low = text.toLowerCase();
  for (const k of OWNER_KINDS) {
    const { any, none } = OWNER_MATCH[k];
    if (hasAny(low, any) && !hasAny(low, none)) return k;
  }
  return null;
}

/** Qattiqroq toifa ustun turadi: harbiy topilsa, boshqa matndagi "xususiy" uni yumshatmaydi. */
const PRIORITY: readonly OwnerKind[] = ['harbiy', 'gigant', 'temiryul', 'davlat', 'xususiy'];

/**
 * Obyektning turi: terminal NOMI va reestrdagi EGA nomi, ikkalasi ham qaraladi.
 *
 * Nega ikkalasi: prodda "11-sonli Jazoni Ijro Etish Koloniyasi" degan qator bor va uning
 * egasi butunlay boshqa nom bilan yozilgan. Faqat ega nomiga qaralsa, bunday qator
 * tasodifan (egasi davlat korxonasi bo'lgani uchun) tushardi, egasi xususiy bo'lganda esa
 * katalogda qolib ketardi.
 *
 * Har matn alohida baholanadi va qattiqrog'i olinadi. Ikkovini birlashtirib bo'lmaydi:
 * qisqartmalar oldidagi bo'sh joyga tayanadi va birlashtirish soxta moslik yasardi.
 *
 * Hech qaysi belgi topilmasa null: bu "bilinmadi" degani, "xususiy" degani emas, shuning
 * uchun bunday qator hech qachon guruh amaliga tushmaydi.
 */
export function ownerKind(name: string | null | undefined, ownerNameRaw?: string | null): OwnerKind | null {
  const kinds = [kindOfText(name), kindOfText(ownerNameRaw)].filter((k): k is OwnerKind => k !== null);
  if (!kinds.length) return null;
  return PRIORITY.find((p) => kinds.includes(p)) ?? null;
}
