# Online to'lov: Payme, Click, Uzum Bank

Obuna buyurtmasi (PAY-1042) online to'langanda obuna **o'zi yoqiladi**: admin tasdig'i kerak emas.
Qo'lda to'lov (bank rekviziti + admin "Tasdiqlash") avvalgidek qoladi.

Kalitlar bo'lmaguncha tizim o'chiq turadi: obuna sahifasida to'lov tugmalari ko'rinmaydi va
har bir foydalanuvchiga **bir martalik 10 kunlik bepul sinov** taklif qilinadi
(`SUBSCRIPTION_TRIAL_DAYS`). Birorta tizim ulanishi bilan sinov taklifi o'zi yo'qoladi
(olingan sinovlar o'z muddatigacha ishlayveradi).

## 1. Shartnoma

Har bir tizim bilan YukSaroy MChJ nomidan shartnoma tuziladi, merchant kabinet ochiladi.
Ularga quyidagilarni bering:

| Tizim | Bizning manzil (callback) | Hisob maydoni |
|---|---|---|
| Payme | `https://yuksaroy.uz/api/v1/payments/payme` | `order_id` (kabinetda "Account" sozlamasi) |
| Click | Prepare: `https://yuksaroy.uz/api/v1/payments/click/prepare`<br>Complete: `https://yuksaroy.uz/api/v1/payments/click/complete` | `merchant_trans_id` = PAY-1042 |
| Uzum Bank | `https://yuksaroy.uz/api/v1/payments/uzum/` + `check`, `create`, `confirm`, `reverse`, `status` | `account` (Uzum menejeri bilan shu nomni kelishing) |

Summa: Payme va Uzum tiyinda, Click so'mda. Bizning tomonda hammasi avtomatik.

## 2. Kalitlar

GitHub → repo → Settings → Secrets and variables → Actions → **Secrets**:

| Secret | Qayerdan |
|---|---|
| `PAYME_MERCHANT_ID` | Payme kabineti: kassa ID |
| `PAYME_KEY` | Payme kabineti: kassa kaliti (sinov uchun TEST_KEY) |
| `PAYME_LOGIN` | Shart emas, sukut `Paycom`. Payme boshqa login bersagina |
| `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`, `CLICK_SECRET_KEY` | Click kabineti |
| `UZUM_SERVICE_ID`, `UZUM_LOGIN`, `UZUM_PASSWORD` | Uzum Bank menejeri beradi |

Sinov rejimi: **Variables** bo'limida `PAYME_TEST=1` (test.paycom.uz). Haqiqiy to'lovga o'tganda
uni `0` qiling va serverdagi `.env` da `PAYME_KEY` ni haqiqiy kalitga almashtiring.

Keyingi deploy kalitlarni serverdagi `.env` ga **faqat yo'q bo'lsa** qo'shadi. Mavjud kalitni
o'zgartirish uchun serverda `.env` ni qo'lda tahrirlang va `docker compose ... up -d api` qiling.

## 3. Sinash

1. Saytga kiring → Kabinet → Obuna → buyurtma bering.
2. "Payme orqali to'lash" tugmasi chiqadi. Payme sinov muhitida (test.paycom.uz) Payme
   "Pesochnitsa" sahifasidagi sinov kartasi bilan to'lang.
3. Obuna sahifasi "Obuna faol" bo'lishi kerak. Admin → Obunalar ro'yxatida provider `payme`.
4. Payme pesochnitsasidagi barcha tekshiruvlar (CheckPerform, Create, Perform, Cancel,
   CheckTransaction, GetStatement, xato kalit, noto'g'ri summa) o'tishi kerak.

Har bir to'lov so'rovi audit jurnaliga `payment.*` nomi bilan yoziladi (kalitlar yozilmaydi).

## 4. Pulni qaytarish

Tizim to'langan tranzaksiyani bekor qilsa (Payme CancelTransaction, Uzum reverse) obuna
darhol yopiladi va daromaddan chiqadi.
