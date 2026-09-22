/**
 * Telefon kodlari ro'yxati.
 *
 * Nega qisqa ro'yxat: har kod qo'lda yozilgan va noto'g'ri kod odamni hisobiga kirita
 * olmay qo'yadi, shuning uchun bu yerda faqat tekshirilgan va O'zbekiston yuk bozoriga
 * tegishli davlatlar turadi (qo'shnilar, MDH, asosiy savdo yo'nalishlari, Yevropa va
 * yirik iqtisodlar). Ro'yxatda yo'q davlat uchun "Boshqa davlat" bor: u yerda odam
 * kodni o'zi yozadi, ya'ni hech kim to'silib qolmaydi.
 *
 * Nom rus va ingliz tillarida brauzerning o'z jadvalidan olinadi, o'zbekchasi esa
 * quyida yozilgan (sababi o'sha jadval ustida).
 */
export type Country = { iso: string; dial: string };

export const COUNTRIES: readonly Country[] = [
  // Qo'shnilar va Markaziy Osiyo
  { iso: 'UZ', dial: '998' },
  { iso: 'KZ', dial: '7' },
  { iso: 'KG', dial: '996' },
  { iso: 'TJ', dial: '992' },
  { iso: 'TM', dial: '993' },
  { iso: 'AF', dial: '93' },
  // MDH va qo'shni mintaqa
  { iso: 'RU', dial: '7' },
  { iso: 'BY', dial: '375' },
  { iso: 'UA', dial: '380' },
  { iso: 'AZ', dial: '994' },
  { iso: 'GE', dial: '995' },
  { iso: 'AM', dial: '374' },
  { iso: 'MD', dial: '373' },
  // Asosiy savdo yo'nalishlari
  { iso: 'CN', dial: '86' },
  { iso: 'TR', dial: '90' },
  { iso: 'IR', dial: '98' },
  { iso: 'IN', dial: '91' },
  { iso: 'PK', dial: '92' },
  { iso: 'MN', dial: '976' },
  { iso: 'KR', dial: '82' },
  { iso: 'JP', dial: '81' },
  { iso: 'VN', dial: '84' },
  { iso: 'TH', dial: '66' },
  { iso: 'MY', dial: '60' },
  { iso: 'SG', dial: '65' },
  { iso: 'ID', dial: '62' },
  // Yaqin Sharq
  { iso: 'AE', dial: '971' },
  { iso: 'SA', dial: '966' },
  { iso: 'QA', dial: '974' },
  { iso: 'KW', dial: '965' },
  { iso: 'OM', dial: '968' },
  { iso: 'BH', dial: '973' },
  { iso: 'JO', dial: '962' },
  { iso: 'IQ', dial: '964' },
  { iso: 'IL', dial: '972' },
  { iso: 'EG', dial: '20' },
  // Yevropa
  { iso: 'DE', dial: '49' },
  { iso: 'PL', dial: '48' },
  { iso: 'LT', dial: '370' },
  { iso: 'LV', dial: '371' },
  { iso: 'EE', dial: '372' },
  { iso: 'FI', dial: '358' },
  { iso: 'SE', dial: '46' },
  { iso: 'NO', dial: '47' },
  { iso: 'DK', dial: '45' },
  { iso: 'CZ', dial: '420' },
  { iso: 'SK', dial: '421' },
  { iso: 'AT', dial: '43' },
  { iso: 'CH', dial: '41' },
  { iso: 'HU', dial: '36' },
  { iso: 'RO', dial: '40' },
  { iso: 'BG', dial: '359' },
  { iso: 'RS', dial: '381' },
  { iso: 'HR', dial: '385' },
  { iso: 'SI', dial: '386' },
  { iso: 'GR', dial: '30' },
  { iso: 'IT', dial: '39' },
  { iso: 'FR', dial: '33' },
  { iso: 'ES', dial: '34' },
  { iso: 'PT', dial: '351' },
  { iso: 'NL', dial: '31' },
  { iso: 'BE', dial: '32' },
  { iso: 'GB', dial: '44' },
  { iso: 'IE', dial: '353' },
  // Amerika va boshqalar
  { iso: 'US', dial: '1' },
  { iso: 'CA', dial: '1' },
  { iso: 'BR', dial: '55' },
  { iso: 'MX', dial: '52' },
  { iso: 'AU', dial: '61' },
  { iso: 'NZ', dial: '64' },
  { iso: 'ZA', dial: '27' },
  { iso: 'MA', dial: '212' },
  { iso: 'DZ', dial: '213' },
  { iso: 'TN', dial: '216' },
];

/** Ro'yxatda yo'q davlat: kod qo'lda yoziladi. */
export const OTHER = 'OTHER';

/**
 * O'zbekcha nomlar shu yerda yozilgan.
 *
 * Nega qo'lda: brauzerlarning o'zbek tili uchun davlat nomlari jadvali to'liq emas va
 * Intl.DisplayNames o'zbekcha so'ralganda jimgina brauzer tiliga qaytib ketadi, ya'ni
 * o'zbekcha sahifada ruscha nomlar chiqardi. Rus va ingliz tillari uchun brauzer jadvali
 * ishonchli, shuning uchun ular yozilmaydi.
 */
const UZ_NAMES: Record<string, string> = {
  UZ: "O'zbekiston", KZ: "Qozog'iston", KG: "Qirg'iziston", TJ: 'Tojikiston', TM: 'Turkmaniston', AF: "Afg'oniston",
  RU: 'Rossiya', BY: 'Belarus', UA: 'Ukraina', AZ: 'Ozarbayjon', GE: 'Gruziya', AM: 'Armaniston', MD: 'Moldova',
  CN: 'Xitoy', TR: 'Turkiya', IR: 'Eron', IN: 'Hindiston', PK: 'Pokiston', MN: "Mo'g'uliston",
  KR: 'Janubiy Koreya', JP: 'Yaponiya', VN: 'Vetnam', TH: 'Tailand', MY: 'Malayziya', SG: 'Singapur', ID: 'Indoneziya',
  AE: 'Birlashgan Arab Amirliklari', SA: 'Saudiya Arabistoni', QA: 'Qatar', KW: 'Quvayt', OM: 'Ummon', BH: 'Bahrayn',
  JO: 'Iordaniya', IQ: 'Iroq', IL: 'Isroil', EG: 'Misr',
  DE: 'Germaniya', PL: 'Polsha', LT: 'Litva', LV: 'Latviya', EE: 'Estoniya', FI: 'Finlyandiya', SE: 'Shvetsiya',
  NO: 'Norvegiya', DK: 'Daniya', CZ: 'Chexiya', SK: 'Slovakiya', AT: 'Avstriya', CH: 'Shveysariya', HU: 'Vengriya',
  RO: 'Ruminiya', BG: 'Bolgariya', RS: 'Serbiya', HR: 'Xorvatiya', SI: 'Sloveniya', GR: 'Gretsiya', IT: 'Italiya',
  FR: 'Fransiya', ES: 'Ispaniya', PT: 'Portugaliya', NL: 'Niderlandiya', BE: 'Belgiya', GB: 'Buyuk Britaniya', IE: 'Irlandiya',
  US: 'AQSH', CA: 'Kanada', BR: 'Braziliya', MX: 'Meksika', AU: 'Avstraliya', NZ: 'Yangi Zelandiya',
  ZA: 'Janubiy Afrika', MA: 'Marokash', DZ: 'Jazoir', TN: 'Tunis',
};

/**
 * Davlat nomi foydalanuvchi tilida. Jadval topilmasa kodning o'zi qaytadi:
 * bu holda ham ro'yxat o'qilarli bo'lib qoladi.
 */
export function countryName(iso: string, locale: string): string {
  if (locale === 'uz') return UZ_NAMES[iso] ?? iso;
  try {
    // Ikkinchi til ataylab: so'ralgan til topilmasa brauzer tiliga emas, inglizchaga qaytsin
    return new Intl.DisplayNames([locale, 'en'], { type: 'region' }).of(iso) ?? iso;
  } catch {
    return UZ_NAMES[iso] ?? iso;
  }
}

/**
 * E.164 qiymatni davlat va milliy qismga ajratadi. Eng uzun mos keladigan kod olinadi,
 * aks holda "+998..." +9 (ro'yxatda yo'q) deb o'qilib ketardi.
 * Bir kodni bir necha davlat bo'lishadi (+7, +1): ro'yxatdagi birinchisi olinadi,
 * chunki raqamning o'zidan qaysi davlat ekanini bilib bo'lmaydi.
 */
export function splitPhone(value: string): { iso: string; national: string } {
  const d = value.replace(/\D/g, '');
  if (!d) return { iso: 'UZ', national: '' };
  let best: Country | null = null;
  for (const c of COUNTRIES) {
    if (d.startsWith(c.dial) && (!best || c.dial.length > best.dial.length)) best = c;
  }
  if (!best) return { iso: OTHER, national: d };
  return { iso: best.iso, national: d.slice(best.dial.length) };
}

export const dialOf = (iso: string): string => COUNTRIES.find((c) => c.iso === iso)?.dial ?? '';
