# YukSaroy — AI va ma'lumot qatlami (lens: `ai`)

Rol: AI Product Engineer. Manba: `yuksaroy-context.md` (konsepsiya, SLA, demo IA, VagonFlow sxemasi), VagonFlow `schema.prisma` (Siding/Station/Client), `claude-api` skill (model/narx jadvali, 2026-06-24 kesh), web-manbalar (5-bo'lim).

## 0. Beshta qaror (xulosa)

| # | Qaror | Nima uchun | Alternativa (rad etildi) |
|---|---|---|---|
| 1 | AI — alohida mikroservis emas, VagonFlow/YukSaroy monolitida `src/lib/ai/` moduli | Bitta jamoa, bitta deploy, Prisma'ga to'g'ridan-to'g'ri kirish; MVP'da 4–5 ta prompt bor, xolos | Python FastAPI "AI service" — F3'da GPU/ML modellari paydo bo'lganda |
| 2 | LLM faqat **matn** yozadi/o'qiydi; **raqamlar** (vagon №, davr, narx) DB'dan keladi va kod tekshiradi | Rasmiy hujjatda LLM to'qib chiqargan bitta vagon raqami — butun mahsulotga ishonchni yo'qotadi | "LLM hamma narsani generatsiya qilsin" — schema-valid bo'lsa ham semantik xato beradi |
| 3 | Narx/ETA/navbat bashorati — LLM emas, LightGBM (jadval-ML); LLM faqat natijani odam tiliga tushuntiradi | Regressiya masalasi LLM'ga berilsa qimmat, sekin va tekshirib bo'lmaydi | LLM'dan raqam so'rash — yo'q |
| 4 | PII chet elga ketmaydi: pseudonimizatsiya (`{{PERSON_1}}`, `{{PHONE_1}}`) API'gacha, qayta almashtirish API'dan keyin | 27.03.2026 tuzatishlardan keyin ham qoidalar noaniq (adekvat davlatlar ro'yxati hali VM tomonidan tasdiqlanmagan), Anthropic `inference_geo` faqat `us`/`global` | On-prem open-weight model — F3'da KYC/passport OCR uchun baholanadi |
| 5 | Ma'lumot platformasi F1'da Postgres + Metabase; PostHog va ClickHouse F2/F3'da | 20 terminal × 3 000 bitim/oy = ~100 ming event/oy — Postgres bemalol ko'taradi | Boshidanoq ClickHouse+Kafka — ortiqcha ops yuki |

## 1. AI use-case reestri

Model narxlari (`claude-api` skill, Anthropic 1-tomon API): Sonnet 5 `claude-sonnet-5` $2/$10 per MTok (in/out), Haiku 4.5 `claude-haiku-4-5` $1/$5, Opus 5 `claude-opus-5` $5/$25; kesh o'qish ≈ 0.1× input narxi, kesh yozish 1.25×; Batch API −50%. Xarajat — bitta so'rov uchun tokenlar bo'yicha hisoblangan taxmin.

| # | Use-case | Qiymat (kimga) | Ma'lumot talabi | Model | ≈ $/so'rov | Xavf | Faza |
|---|---|---|---|---|---|---|---|
| 1 | Stansiya boshlig'iga xat (shahobcha yo'lga vagon qo'yish) | Mijoz: 3 daqiqa vs 1 kun; stansiya: standart format | `Siding`, `Station`, `Client`, vagon ro'yxati, davr, egasi roziligi | Sonnet 5, structured output | 0.008–0.01 (system 2k kesh + 700 in + 600 out) | Raqam to'qish → kod tekshiruvi (3-bo'lim) | **MVP** |
| 2 | Boshqa hujjat matnlari: GU-12 izoh, dalolatnoma tavsif qismi, qayta jo'natish arizasi | "Stol uslug" mutaxassisi 4 soat → 20 daqiqa | Buyurtma + yuk + hujjat shabloni | Sonnet 5 | ~0.01 | Normativ formulirovka xatosi → mutaxassis tasdig'i majburiy (human-in-the-loop) | F2 |
| 3 | Tarif/narx bashorati ("bu yo'nalishda adolatli narx") | Mijoz: narx shaffofligi; terminal: benchmark | ≥ 6 oy bitim tarixi (`Order.sum`, terminal, yuk turi, tonnaj, oy) | LightGBM (ML), izoh — Haiku 4.5 | ML: 0; izoh 0.0013 | Kam ma'lumotda noto'g'ri "adolatli" narx — F1'da faqat median ko'rsatiladi | F3 |
| 4 | ETA (vagon qachon keladi) va navbat bashorati (slot tiqilishi) | Mijoz: 24 soat oldin ogohlantirish; terminal: resurs rejasi | ASOUP dislokatsiya (F2 API) yoki qo'lda status; slot tarixi | Regressiya/survival (ML), LLM yo'q | 0 | ASOUP'siz aniqlik past → "taxminiy" belgisi bilan | F2 (slot), F3 (ETA) |
| 5 | Porojnyak tavsiyasi: bo'sh qaytayotgan fura/vagonga yuk | Tashuvchi: bo'sh yurish −; platforma: bitim + | E'lonlar, yo'nalish, sana, GPS (F2) | SQL matching + scoring; xabar matni Haiku 4.5 | 0.001 | Spam-tavsiya → kuniga max 3 push | F2 |
| 6 | OCR: GU-29/SMGS nakladnoy → strukturaviy maydonlar | Mijoz qo'lda 25 maydon kiritmaydi | Skan/foto (JPEG/PDF), kirill+lotin o'zbek, rus | Sonnet 5 vision (1 sahifa ≈ 1.6k token) | 0.012/sahifa (Haiku 0.006) | Qo'lyozma/xira nusxa → `confidence` maydoni, past bo'lsa foydalanuvchi tasdiqlaydi | F2 |
| 7 | OCR: tarozi cheki (vazn, sana, vagon №) | Vazn nizolarida dalil; dalolatnoma avtomatik | Chek foto | Haiku 4.5 vision | 0.004 | Raqam adashishi → vagon № kontrol raqami tekshiruvi | F2 |
| 8 | Mijoz-yordamchi (RAG: ЮҚТ, tarif siyosati, SMGS, platforma FAQ) | Qo'llab-quvvatlash qo'ng'iroqlari −40% (maqsad) | Normativ hujjatlar PDF → bo'laklar (chunk) + pgvector | Sonnet 5 (normativ savolda Opus 5) | 0.016 (Opus 0.04) | Noto'g'ri huquqiy javob → har javobda manba moddasi + "yuridik maslahat emas" | F2 |
| 9 | Anomaliya/fraud: soxta e'lon, reyting shishirish, dublikat aktiv | Ishonch qatlami | E'lon matni, foydalanuvchi grafi, IP/qurilma, baho vaqti | Qoidalar (SQL) + Haiku 4.5 matn-klassifikator | 0.001 | False positive → avtomatik blok emas, moderator navbati | F2 |
| 10 | Avtomatik kategoriyalash: yuk nomi → ETSNG kodi, e'lon → kategoriya | Katalog sifati, qidiruv | ETSNG klassifikatori (Desktop'da bor) | Haiku 4.5, system'da ETSNG top-300 (kesh) | 0.0007 | Noto'g'ri kod → tarif xato: top-3 taklif, foydalanuvchi tanlaydi | **MVP** |
| 11 | Ovozli buyurtma (o'zbek STT) — Telegram-bot/mobil | Kichik mijoz, haydovchi: yozmaydi, gapiradi | Audio → matn → buyurtma JSON | STT: Aisha AI API (o'zbek dialektlar) yoki self-host Whisper large-v3; ekstraksiya Haiku 4.5 | STT narxi so'rov bo'yicha; ekstraksiya 0.001 | Whisper'da o'zbek WER yuqori (past resursli til) → Aisha birinchi, Whisper zaxira | F3 |
| 12 | Tarjima uz-Latn/uz-Cyrl/ru/en (e'lonlar, terminal pasporti) | 4 til, bitta kiritish | Matn maydonlari | Haiku 4.5, Batch API | 0.003 (batch 0.0015) | Terminologiya (полувагон/yarim vagon) → glossariy system'da | **MVP** |
| 13 | Text-to-SQL boshqaruv uchun ("o'tgan oy Sergeli'da nechta slot bo'sh qoldi?") | Boshqarma: analitik kutmaydi | Prisma sxema → DDL + 30 ta namuna so'rov, read-only replica | Opus 5 (Sonnet 5 arzon variant) | 0.016 (Sonnet 0.007) | Noto'g'ri JOIN → xato raqam: faqat `SELECT`, `EXPLAIN` + 5 s timeout + SQL ko'rsatiladi | F3 |
| 14 | Terminal pasportini anketa/PDF'dan avto-to'ldirish | 1 sahifalik anketa → 40 maydon | Anketa skan | Sonnet 5 vision + structured output | 0.02/hujjat | Xato maydon → terminal egasi tasdiqlaydi | F1 (pilot onboarding) |
| 15 | E'lon sifatini oshirish (sarlavha/tavsif qayta yozish, yetishmayotgan maydonlarni so'rash) | Konversiya | E'lon matni | Haiku 4.5 | 0.002 | "Ko'p va'da" matn → faqat kiritilgan faktlar, `warnings` | F2 |
| 16 | Nizo/arbitraj xulosasi (daʼvo + foto-dalil + audit-log → xulosa loyihasi) | Arbitr 3 kun SLA'ni ushlaydi | `AuditLog`, buyurtma, rasmlar | Sonnet 5 | 0.03 | Qaror LLM'niki emas — faqat loyiha, arbitr imzolaydi | F3 |
| 17 | Aktivatsiya to'lqinlari uchun SMS/push personalizatsiyasi (18 428 mijoz) | Konversiya +; 500–1000/to'lqin | Mijoz segmenti, stansiya, yuk turi | Haiku 4.5 Batch | 0.0005 | Spam hissi → 2–3 variant, A/B | **MVP** |
| 18 | Mijoz oylik hisoboti narrativi ("qancha tashidi, qancha tejadi") | Obuna qiymati | Agregat SQL natijasi | Sonnet 5 | 0.02/mijoz/oy | Raqam o'zgartirish → LLM'ga tayyor raqamlar beriladi, o'zi hisoblamaydi | F3 |

**Reestr bo'yicha izohlar.**
- **Model tanlash qoidasi:** klassifikatsiya/qisqa matn → Haiku 4.5 (200K kontekst, `thinking` kerak emas); hujjat/narrativ/vision → Sonnet 5 (`thinking: {type:"adaptive"}`, `effort: "medium"`); huquqiy RAG va text-to-SQL → Opus 5 (`effort: "high"`) — xato narxi yuqori. `claude-api` skill'i default sifatida Opus 5'ni tavsiya qiladi; biz ataylab use-case bo'yicha pasaytiramiz, chunki #10/#12/#17 hajmi oyiga 10 000+ so'rov.
- **MVP'da oylik xarajat taxmini:** 400 xat × $0.01 + 5 000 kategoriyalash × $0.0007 + 3 000 tarjima × $0.003 + 2 000 SMS × $0.0005 ≈ **$18/oy**. AI — xarajat emas, mahsulot farqi.
- **ML (3, 4, 5) — ma'lumot to'planmaguncha yo'q.** Konsepsiyadagi tartib to'g'ri: eskrou+verifikatsiya → ma'lumot → AI-tavsiya. F1'da "adolatli narx" o'rniga oddiy median + kvartil ko'rsatiladi (SQL, 0$).

## 2. Arxitektura

### 2.1 AI gateway — modul, mikroservis emas

```
src/lib/ai/
  client.ts          # Anthropic singleton: timeout 60s, maxRetries 2, inference_geo:"us"
  prompts/
    station-letter.ts   # frozen system prompt, PROMPT_VERSION = "2026-09-03.1"
    etsng-classify.ts
    ocr-nakladnoy.ts
    translate.ts
  schemas/
    station-letter.ts   # zod → zodOutputFormat
    ocr-nakladnoy.ts
  pii.ts             # pseudonymize(text, entities) / restore()
  usage.ts           # logAiCall() → Prisma AiCall
  letter.ts          # generateStationLetter(sidingId, clientId, wagons, period)
src/app/api/ai/
  letter/route.ts    # POST, streaming, RBAC: CONSIGNEE|KARGO|EDC
  classify/route.ts
  ocr/route.ts
prisma: model AiCall { id feature model promptVersion inputTokens cacheReadTokens
        cacheWriteTokens outputTokens costUsd latencyMs userId ok error createdAt }
```

- **Nima uchun modul:** Next.js 16 App Router'da route handler + server action bor; Prisma allaqachon shu yerda; AI chaqiruvlar 5 ta funksiyadan iborat. Alohida servis = ikkinchi deploy, ikkinchi auth, ikkinchi log.
- **`AiCall` jadvali majburiy** — birinchi haftadanoq har chaqiruvda `usage.cache_read_input_tokens` yoziladi; bu kesh ishlayotganini isbotlovchi yagona ground truth (0 bo'lsa — silent invalidator bor).
- **Navbat:** sinxron so'rovlar (xat, kategoriyalash) — to'g'ridan-to'g'ri; ommaviy ishlar (tarjima 3 000 e'lon, SMS 1 000 mijoz) — Message Batches API (`client.messages.batches.create`, 24 soat ichida, −50%). BullMQ/Redis navbati kerak emas — Batches API o'zi navbat.
- **Alternativa:** Vercel AI SDK / LangChain — rad. Sabab: bitta provayder, 5 prompt; abstraksiya qatlami keshni buzadigan avtomatik prompt qayta-yig'ishni yashiradi.

### 2.2 Prompt caching

Tartib: `tools → system → messages`. Barqaror qism birinchi:
1. `system[0]` — rol + qoidalar + normativ parcha (masalan ЮҚТ'ning shahobcha yo'lga vagon berish bo'yicha moddasi matni) + `cache_control: {type:"ephemeral"}`; hajm ≥ minimal keshlanadigan prefiks (model bo'yicha 512–4096 token — Haiku'da yuqoriroq, shuning uchun ETSNG ro'yxatini system'ga qo'shib 2k+ tokenga yetkazamiz).
2. `messages[0].user` — faqat o'zgaruvchan JSON (buyurtma ma'lumoti). Sana/vaqt/ID system'ga hech qachon kirmaydi.
3. Prompt matni `PROMPT_VERSION` bilan versiyalanadi; o'zgarish = kesh reset — atayin, jurnalga yoziladi.
4. TTL: 5 daqiqa (default). Xat generatsiyasi trafigi 5 daqiqadan siyrak bo'ladi → kesh ko'pincha sovuq; bu holda foyda 0.1× emas, lekin 1.25× yozish zarari ham 2k tokenda ~$0.005. Qabul qilinadi. 1 soatlik TTL faqat #8 (chat) va #13 (analitika) uchun, u yerda seans ichida 5–60 daqiqalik pauzalar tabiiy.

### 2.3 Structured output

`client.messages.parse({ output_config: { format: zodOutputFormat(Schema) } })` — `output_format` eskirgan. Qoidalar:
- Har schema'da `warnings: string[]` — model nomuvofiqlikni (davr shartnoma muddatidan tashqarida, sig'imdan ko'p vagon) shu yerga yozadi, matnga emas.
- `parsed_output === null` → 1 marta retry, keyin foydalanuvchiga "qo'lda tahrir" rejimi. Schema'ga mos kelmagan javob hech qachon hujjatga aylanmaydi.
- Structured output `citations` bilan birga ishlamaydi (400) → RAG (#8) uchun `citations` tanlanadi, JSON emas; javob matn + manba bloklari.

### 2.4 Tool use — qayerda kerak, qayerda yo'q

| Use-case | Tool use? | Sabab |
|---|---|---|
| Xat (#1), OCR (#6,#7), kategoriyalash (#10), tarjima (#12) | **Yo'q** — bitta chaqiruv, structured output | Kod ma'lumotni oldindan yig'adi; modelga DB'ga yo'l berish shart emas |
| Text-to-SQL (#13) | **Ha**: `run_sql(query)` (read-only replica, `SET statement_timeout=5000`), `get_schema(table)`; `strict: true`, `client.beta.messages.toolRunner` | Model xatoni ko'rib SQL'ni tuzatadi — bitta chaqiruvda 40% xato, loop'da <10% (o'lchash kerak) |
| Mijoz-yordamchi (#8) | **Ha**: `search_docs(q)` (pgvector), `get_order_status(no)` | RAG + jonli status bitta suhbatda; `disable_parallel_tool_use` shart emas |
| Nizo xulosasi (#16) | **Ha**: `get_audit_log(orderId)`, `get_photos(orderId)` | 30 sahifali log'ni promptga tiqmaslik |

Fable 5.1 kabi modellarda `tool_choice: any/tool` 400 qaytaradi — shuning uchun boshidan `auto` + promptda tool nomi; Sonnet/Opus 5'da ham shu odat.

### 2.5 PII va ma'lumot lokalizatsiyasi

Faktlar (2026-09 holati):
- ZRU-547 "Shaxsga doir ma'lumotlar to'g'risida" (02.07.2019), 27-1-modda — fuqarolar PD'si O'zbekiston hududidagi serverlarda saqlanishi shart edi.
- 27.03.2026 kuchga kirgan tuzatishlar: oddiy PD toifalari axborot xavfsizligi talablari bajarilganda chet elda saqlanishi mumkin; **biometrik, genetik va telekommunikatsiya** ma'lumotlari faqat ichkarida; adekvat himoya davlatlari ro'yxatini Vazirlar Mahkamasi tasdiqlaydi (Dentons, kun.uz, daryo.uz). Ro'yxat e'lon qilinganmi — yurist tekshiradi; AQSh ro'yxatda bo'lmasa, Anthropic'ka PD yuborish hali ham chegaralangan.
- Anthropic API: `inference_geo` faqat `"us"` / `"global"`; workspace geo `us`; O'zbekiston/EU rejimi yo'q. Zero Data Retention — shartnoma orqali so'raladi (Fable 5.1'ga taalluqli emas, biz uni ishlatmaymiz).

Qaror — **uch qatlam:**
1. **Yuridik shaxs ma'lumoti** (korxona nomi, STIR, manzil, shartnoma №) — shaxsga doir emas, API'ga ketadi.
2. **Jismoniy shaxs** (direktor F.I.Sh., telefon, YaTT STIR'i, haydovchi) — `pii.ts` almashtiradi: `{{PERSON_1}}`, `{{PHONE_1}}`; javobda qayta o'rniga qo'yiladi. Xatda "Direktor: {{PERSON_1}}" — model uchun kifoya, chunki u ismni o'zgartirmaydi, faqat joyini biladi.
3. **Passport/guvohnoma skanlari (KYC)** — API'ga umuman yubormaymiz. F1–F2: moderator qo'lda; F3: on-prem open-weight vision model (vLLM, Toshkent DC'da 1×GPU) baholanadi. Alternativa — Tesseract `uzb_cyrl`/`uzb` (mavjud, bepul) — chop etilgan hujjatda ishlaydi, foto/qo'lyozmada yo'q.

Bundan tashqari `AiCall`ga promptning o'zi yozilmaydi (faqat hash + tokenlar) — DB'da ikkinchi PII nusxasi paydo bo'lmasin.

### 2.6 Evaluatsiya

- **Golden set** (foydalanuvchi — soha eksperti — belgilaydi): 50 xat (10 tasi ataylab nomuvofiq: davr shartnomadan tashqari, vagon № kontrol raqami xato, 30 vagon 12 sig'imga), 100 ETSNG juftligi, 30 nakladnoy sahifasi.
- **Metrikalar:** schema-valid %, `hallucinated_numbers = 0` (kod: chiqishdagi har 8 xonali raqam kirishda bo'lishi shart), ekspert qabul qilish % (maqsad ≥ 90 %), OCR maydon aniqligi (maqsad ≥ 95 % chop etilgan, ≥ 80 % foto), p95 latency < 8 s.
- **Vosita:** `tests/ai/*.eval.test.ts` (vitest allaqachon bor), `AI_EVAL=1` bilan qo'lda ishga tushadi, CI'da emas (pul). Uslub bahosi — Haiku 4.5 LLM-judge (1–5). Promptfoo — 5+ prompt bo'lganda.
- **Regressiya qoidasi:** `PROMPT_VERSION` o'zgarsa eval majburiy; natija `docs/ai-eval.md`ga jadval qilib qo'shiladi.

## 3. Stansiya boshlig'iga xat — prompt, schema, kod

**Oqim:** Aktivlar bozori → shahobcha yo'l kartasi → «Stansiyaga xat» → forma (vagon №, davr, yuk) → `POST /api/ai/letter` → JSON → server-side validatsiya → HTML/`@media print` (F1) yoki mavjud .docx shablon (F2, `docx` npm) → stansiya kabinetiga yuboriladi → ruxsat № → DSP smenasiga topshiriq.

**Kirish ma'lumoti** (Prisma'dan, LLM'ga tayyor holda):

```ts
type LetterInput = {
  lang: "uz-Cyrl" | "uz-Latn" | "ru";
  station: { name: string; esr: string };                     // Station.name, ecpCode
  applicant: { company: string; stir: string; address: string; directorToken: string /* {{PERSON_1}} */ };
  siding: { name: string; ownerName: string; junctionSwitch?: string; contractNo?: string;
            contractEnd?: string; capacityWagons?: number; occupiedWagons?: number };   // Siding.*
  cargo: { etsng: string; name: string; operation: "yuklash" | "tushirish" };
  wagons: { number: string; type: string }[];                 // 8 xonali, kontrol raqami tekshirilgan
  period: { from: string; to: string };                       // ISO date
  ownerConsent: { given: true; signedAt: string; method: "ERI" | "SMS" };
};
```

**System prompt** (`prompts/station-letter.ts`, qisqartirilgan, keshlanadi):

```
Sen O'zbekiston temir yo'l yuk tashish sohasida rasmiy xatlar tuzuvchi mutaxassissan.
Vazifa: yuk egasi nomidan stansiya boshlig'iga murojaatnoma matnini tuzish —
ko'rsatilgan davrda kelgan vagonlarni ko'rsatilgan shahobcha yo'liga qo'yib berish so'rovi.

Qoidalar:
1. Faqat berilgan JSON'dagi faktlardan foydalan. Vagon raqami, sana, shartnoma raqami,
   ism-familiya, telefon — hech birini qo'shma, o'zgartirma, qisqartirma.
2. {{PERSON_n}} / {{PHONE_n}} ko'rinishidagi belgilarni aynan shu holda saqla.
3. Uslub: rasmiy-ish, murojaat "Hurmatli ... stansiyasi boshlig'i!", 2–4 abzats,
   yakunda aniq so'rov gapi: "...davrida kelgan vagonlarni ... shahobcha yo'liga
   qo'yib berishingizni so'rayman."
4. Egasining roziligi blokini alohida yoz: "{ownerName} ... qarshi emasman" mazmunida,
   3-shaxsda emas, egasi nomidan.
5. Nomuvofiqlik ko'rsang (davr shartnoma muddatidan tashqarida, vagonlar soni bo'sh
   sig'imdan ko'p, yuk turi shahobcha kategoriyasiga mos emas) — matnga yozma,
   warnings ro'yxatiga qisqa gap bilan yoz.
6. Til: lang maydoni bo'yicha; kirill o'zbek uchun rasmiy imlo, lotin uchun 2021 imlo.
7. Chiqish — faqat schema bo'yicha JSON.
```

**Schema** (`schemas/station-letter.ts`):

```ts
import { z } from "zod";
export const StationLetter = z.object({
  subject: z.string().max(160),
  salutation: z.string(),
  body: z.array(z.string()).min(2).max(4),          // abzatslar
  requestSentence: z.string(),                       // yakuniy so'rov gapi
  wagonNumbers: z.array(z.string().regex(/^\d{8}$/)),// aynan kirishdagi to'plam
  period: z.object({ from: z.string(), to: z.string() }),
  consentBlock: z.object({ ownerName: z.string(), text: z.string() }),
  closing: z.string(),                               // "Hurmat bilan, direktor {{PERSON_1}}"
  warnings: z.array(z.string()),
});
```

**Chaqiruv + validatsiya** (`letter.ts`):

```ts
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { SYSTEM, PROMPT_VERSION } from "./prompts/station-letter";
import { StationLetter } from "./schemas/station-letter";

const client = new Anthropic({ timeout: 60_000 });

// ponytail: 8 xonali vagon raqami kontrol raqami (2-1-2-1... vaznlar, raqamlar yig'indisi)
export function wagonCheckDigitOk(n: string) {
  if (!/^\d{8}$/.test(n)) return false;
  const sum = [...n.slice(0, 7)].reduce((s, d, i) => {
    const p = +d * (i % 2 === 0 ? 2 : 1);
    return s + Math.floor(p / 10) + (p % 10);
  }, 0);
  return (10 - (sum % 10)) % 10 === +n[7];
}

export async function generateStationLetter(input: LetterInput) {
  const bad = input.wagons.filter(w => !wagonCheckDigitOk(w.number));
  if (bad.length) throw new Error(`Vagon raqami noto'g'ri: ${bad.map(b => b.number).join(", ")}`);

  const t0 = Date.now();
  const res = await client.messages.parse({
    model: "claude-sonnet-5",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: zodOutputFormat(StationLetter) },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: JSON.stringify(input) }],
  });
  const out = res.parsed_output;
  if (!out) throw new Error("schema-invalid");

  // Semantik tekshiruv — LLM'ga ishonmaymiz
  const want = new Set(input.wagons.map(w => w.number));
  const same = out.wagonNumbers.length === want.size && out.wagonNumbers.every(n => want.has(n));
  if (!same) throw new Error("wagon set mismatch");
  if (out.period.from !== input.period.from || out.period.to !== input.period.to) throw new Error("period mismatch");
  const allText = [out.subject, ...out.body, out.requestSentence, out.consentBlock.text, out.closing].join(" ");
  const strayNumbers = (allText.match(/\b\d{8}\b/g) ?? []).filter(n => !want.has(n));
  if (strayNumbers.length) throw new Error(`stray numbers: ${strayNumbers.join(",")}`);

  await logAiCall({ feature: "station-letter", model: "claude-sonnet-5", promptVersion: PROMPT_VERSION,
    usage: res.usage, latencyMs: Date.now() - t0, ok: true });
  return out;
}
```

Kodli tekshiruvlar (`warnings`dan tashqari, bloklovchi): vagon to'plami tengligi, davr tengligi, "begona" 8 xonali raqam yo'qligi, `period.to <= siding.contractEnd` (bo'lsa), `wagons.length <= capacityWagons - occupiedWagons` (ogohlantirish, blok emas — stansiya qaror qiladi). Xat PDF'iga `AiCall.id` + QR (tekshiruv URL) qo'yiladi — kontekstdagi .docx shablonda QR joyi bor.

Skipped: xat matnini tahrirlash uchun ikkinchi LLM chaqiruvi — foydalanuvchi matnni oddiy textarea'da tuzatadi, qayta validatsiya kodda ishlaydi. Kerak bo'lsa F2'da "qayta yoz" tugmasi.

## 4. Ma'lumot platformasi

### 4.1 Event tracking

| Faza | Yechim | Nima uchun |
|---|---|---|
| F1 | Prisma `Event { id userId role name props Json sessionId createdAt }`, oyma-oy partition; frontend `track("catalog_filter", {...})` → `POST /api/events` (batch 20 ta) | Hajm ~100 ming event/oy; `AuditLog` bilan bir xil pattern; hech qanday yangi infra yo'q |
| F2 | PostHog **hobby** (docker-compose, MIT, bitta VM) | Session replay + funnel — "UI lol qoldirdimi" savoliga o'lchov; PostHog hujjati: self-host rasmiy qo'llab-quvvatlanmaydi, bitta mashina, "bir necha yuz ming event"gacha — bizga F2'da yetadi |
| F3 (>1 mln event/oy) | PostHog Cloud (EU region) yoki o'z `Event` → ClickHouse | Hobby chegarasi; PII (telefon) eventga yozilmaydi — faqat `userId` |

Event nomlari — bitta fayl `src/lib/events.ts`da enum: `catalog_view`, `catalog_filter`, `order_step` (step 1–4), `order_submit`, `slot_pick`, `terminal_decide` (accept/reject, latency), `letter_generate`, `letter_send`, `ad_view`, `ad_contact_click`. Konsepsiya KPI'lari (slot onlayn %, tasdiqlash vaqti, kutish vaqti) shu 10 eventdan hisoblanadi.

### 4.2 Data warehouse

- **F1–F2:** Postgres 17 **read replica** (docker-compose'da ikkinchi konteyner, streaming replication) + `analytics` sxemasida materialized view'lar (`mv_terminal_daily`, `mv_order_funnel`, `mv_sla`), `REFRESH MATERIALIZED VIEW CONCURRENTLY` node-cron bilan har 15 daqiqada (node-cron allaqachon bor). Nima uchun: 3 000 bitim/oy × 5 yil = 180 ming qator — indeks bilan sekundlar.
- **F3 (>50 mln qator yoki dashboard >5 s):** ClickHouse + **PeerDB** (ClickHouse tomonidan sotib olingan, ELv2 litsenziya, self-host CDC) Postgres → ClickHouse. ClickHouse Cloud ClickPipes'ga ehtiyoj yo'q — Toshkent VM'da ishlaydi. Alternativa: Debezium+Kafka — 3 komponent vs 1; rad.
- Pilot terminal ma'lumotlari ("Yagona darcha" 18 428 mijoz, Шахобча йўллар.xlsx, ESR) — `xlsx` dep bilan `scripts/import-*.ts`, idempotent kalit (`registryRef` — VagonFlow'da shu pattern bor).

### 4.3 Dashboardlar

- **Metabase OSS** (AGPL v3, self-host, cheklovsiz foydalanuvchi) — biznes: terminal reytingi, SLA buzilishlari, komissiya, aktivatsiya to'lqinlari konversiyasi; ochiq "Powered by Metabase" bilan static embed — Boshqaruv kabinetidagi «Аналитика» ekraniga iframe. Nima uchun Grafana emas: biznes foydalanuvchi SQL yozmaydi, Metabase query builder bor.
- **Grafana** — faqat ops (Postgres exporter, konteynerlar, `AiCall` xarajati/latency, PeerDB lag). Ikkalasi ham docker-compose'da.
- Boshqaruv uchun `recharts` ekranlari (demo'da bor) — faqat 5–6 ta asosiy KPI; qolgani Metabase. Sabab: har grafik uchun React kod yozish o'rniga SQL savol.
- Metabase OSS'da row-level security yo'q → terminal egasi o'z ma'lumotini Metabase'da emas, Next.js kabinetida ko'radi (RBAC kodda).

### 4.4 ML pipeline — minimal

```
ml/
  features.sql        # ClickHouse/Postgres view: order, terminal, cargo, dow, month, tonnage, slot_hour
  train_price.py      # LightGBM regression → price_p50/p10/p90, MAPE log
  train_eta.py        # LightGBM regression: slot kutish (daqiqa); ETA — ASOUP kelganda
  predict.py          # har kecha 02:00, natija → Postgres Prediction { entityType entityId kind value p10 p90 modelVersion createdAt }
  Dockerfile          # python:3.12-slim + lightgbm + psycopg
```

- Cron: docker-compose'da `ml` servisi, `node-cron` emas — Python konteyneri o'zi `cron` bilan. Next.js `Prediction` jadvalini o'qiydi, xolos.
- Boshlash sharti: ≥ 2 000 yakunlangan bitim va ≥ 6 oy. Ungacha `features.sql`dagi median/kvartil UI'da "bozor narxi" sifatida (bu ham SQL).
- Baholash: holdout oxirgi 1 oy; MAPE < 15 % bo'lsa UI'ga chiqadi, bo'lmasa faqat ichki dashboard. Feature store, MLflow, Airflow — yo'q; bitta jadval + `modelVersion` ustuni yetadi.
- LLM (#3, #18) `Prediction` qatorini oladi va tushuntiradi — o'zi hisoblamaydi.

Skipped: real-time inference servisi (predictions kecha hisoblanadi — narx/kutish kunlik o'zgaradi); pgvector RAG indeksi F2'da (`CREATE EXTENSION vector`, Postgres'da, alohida vektor DB yo'q).

## 5. Manbalar

- Claude model/narx jadvali — `claude-api` skill (Anthropic, kesh 2026-06-24); prompt caching iqtisodi (`shared/prompt-caching.md`); structured output `client.messages.parse` + `zodOutputFormat` (`typescript/claude-api/tool-use.md`).
- Anthropic data residency: [platform.claude.com/docs/en/manage-claude/data-residency](https://platform.claude.com/docs/en/manage-claude/data-residency), [Lingaro — Claude data residency](https://lingarogroup.com/insights/claude-data-residency-and-compliance-explained).
- ZRU-547 matni: [lex.uz/docs/4831939](https://lex.uz/docs/4831939); 27.03.2026 tuzatishlar: [Dentons](https://www.dentons.com/en/insights/articles/2026/march/31/uzbekistan-dismantles-strict-data-localization-regime), [kun.uz](https://kun.uz/en/news/2026/03/27/uzbekistan-amends-personal-data-law-to-facilitate-global-payment-systems), [daryo.uz](https://daryo.uz/en/2026/03/29/uzbekistan-amends-personal-data-law-for-domestic-storage-and-regulated-foreign-processing/), [Legal500](https://www.legal500.com/developments/thought-leadership/personal-data-compliance-in-uzbekistan/).
- PostHog self-host: [docs/self-host](https://posthog.com/docs/self-host), [disclaimer](https://posthog.com/docs/self-host/open-source/disclaimer).
- ClickHouse + PeerDB: [PeerDB acquisition](https://clickhouse.com/blog/clickhouse-welcomes-peerdb-adding-the-fastest-postgres-cdc-to-the-fastest-olap-database), [Postgres+ClickHouse OSS stack](https://clickhouse.com/blog/postgres-clickhouse-oss), [CDC year in review 2025](https://clickhouse.com/blog/postgres-cdc-year-in-review-2025).
- Metabase litsenziya: [metabase.com/license](https://www.metabase.com/license), [GitHub](https://github.com/metabase/metabase).
- O'zbek STT: [Aisha AI STT](https://aisha.group/en/speech-to-text), [Whisper large-v3](https://huggingface.co/openai/whisper-large-v3) (99 til; past resursli tillarda WER 25–35 %+ — [Northflank benchmark](https://northflank.com/blog/best-open-source-speech-to-text-stt-model-in-2026-benchmarks)).
- OCR: Tesseract `uzb_cyrl` — [tessdata](https://github.com/tesseract-ocr/tessdata/blob/main/uzb_cyrl.traineddata).
- VagonFlow `Siding`/`Station`/`Client` maydonlari — `C:/Users/user/Desktop/IT/taminot/taminot-master/prisma/schema.prisma` (1129–1174, 136–166, 257–282 qatorlar).
