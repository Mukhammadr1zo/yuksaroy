# YukSaroy — UI/UX va Hero (video + 3D) tahlili · lens: `uxui`

Rol: Creative Director + Senior Product Designer + Creative Technologist (WebGL). Manba: konsepsiya, Ish standarti v1.0, demo (`artifact-8dc58541`) tokenlari, VagonFlow sxemasi. Faktlar 2026-09 holatiga tekshirilgan (manbalar oxirida).

## 0. Xulosa (5 qaror)

1. Brend nomi va metaforasi: **"Raqamli karvonsaroy"** — Ipak yo'li karvonsaroyi (ravoq, hovli, tartib) + zamonaviy terminal. Motivlar dekor emas, *funksiya* sifatida ishlatiladi (ravoq = rasm maskasi, girih = fon to'qimasi ≤6 % opacity, karvon yo'li = marshrut chizig'i).
2. Hero = **video (10 s loop, ≤2.5 MB) + HTML overlay + scroll'da 3D tarmoq xaritasiga o'tish**. Matn videoda emas, HTML'da (lokalizatsiya uz-lotin/kirill/ru).
3. 3D — **React Three Fiber 9.7 + drei**, Spline emas (railmap JSON'ga ulanish kerak). Byudjet: ≤60 draw call, ≤150 k uchburchak, DPR ≤1.5, mobil'da WebP + CSS parallax.
4. Scroll — **Lenis 1.3.x + GSAP 3.13 ScrollTrigger** (2025-aprel'dan 100 % bepul, Club plaginlari ham). Sahifada ≤3 pin, jami pin ≤500 vh, `prefers-reduced-motion` da hammasi o'chadi.
5. Ilova UX'i landing'dan **boshqa rejim**: motion 80–240 ms, "lol qoldirish" emas — 30 daqiqalik SLA'ni o'tkazib yubormaslik uchun tezlik.

## 1. Dizayn tili

### 1.1 Tokenlar (demo'dagi 3 rangdan to'liq tizimga)

Demo'da allaqachon light/dark juftliklar bor (`--teal #0E9384/#2FC2B0`, `--navy #122A44/#0D1C2F`, `--amber #C77E1E/#E0A24A`, `--teal-ink #0B7568/#5BD6C6`, `--page #F2F5F8/#0A141F`, `--surface #FFFFFF/#111E2E`). Ularni saqlab, quyidagilar qo'shiladi (`packages/design-tokens/tokens.json` → Style Dictionary → CSS vars + Tailwind v4 `@theme` + Figma Variables — bitta manba):

| Token | Light | Dark | Nima uchun |
|---|---|---|---|
| `--sand` | `#E9DCC3` | `#3A3222` | Karvonsaroy g'isht/qum — issiq neytral, teal'ga kontrast juft; faqat landing seksiya fonida |
| `--sand-soft` | `#F6F0E3` | `#22201A` | Hujjat/xat preview qog'oz foni |
| `--teal-glow` | `rgba(14,147,132,.35)` | `rgba(47,194,176,.45)` | 3D nuqtalar, focus ring tashqi halqa |
| `--amber-ink` | `#8F5A12` | `#F0BC6A` | Amber matn uchun (pastga qarang: `#C77E1E` oq fonda **3.3:1** — matnga yaroqsiz) |
| `--rail` | `#8DA0B3` | `#3E5064` | Xarita/sxemadagi rels chiziqlari (demo `--faint` bilan bir xil, semantik nom) |
| `--radius-1/2/3` | 6 / 12 / 20 px | — | Karta = 12, modal = 20, chip = 999 |
| `--radius-arch` | `999px 999px 12px 12px` | — | Ravoq maskasi (rasm/video konteyner) |
| `--shadow-2` | `0 8px 24px -12px rgba(16,35,59,.25)` | `0 8px 24px -12px rgba(0,0,0,.6)` | Hover'da ko'tarilgan karta; 1 ta soya qatlami, "glassmorphism" yo'q |
| `--dur-1…5` | 80 / 160 / 240 / 400 / 700 ms | — | 6-bo'limga qarang |
| `--ease-standard` | `cubic-bezier(.2,0,0,1)` | — | Umumiy |
| `--ease-emph` | `cubic-bezier(.05,.7,.1,1)` | — | Kirish, modal |
| `--ease-exit` | `cubic-bezier(.3,0,1,1)` | — | Chiqish |

Kontrast hisobi (WCAG relative luminance): `#0E9384` oq fonda **3.8:1** → faqat ≥24 px sarlavha, ikonka, chegara; matn uchun `--teal-ink #0B7568` (**5.6:1**). Demo'dagi `--warn #B26A00` matnga yaroqli, `--amber` — yo'q. Bu qoidani lint'ga qo'ying (Stylelint plugin `a11y/color-contrast` yoki Figma'da `Contrast` plugin).

Tipografika (barchasi kirill + lotin glifli, tekshirilgan `Oʻzbekiston · Ғалла · Қўқон · Ҳисоб` satri bilan sinab ko'ring):

| Rol | Shrift | O'lcham (clamp) | Qoida |
|---|---|---|---|
| Display | Unbounded 700 | `clamp(40px, 6vw, 88px)`, line-height 1.0, letter-spacing -0.02em | Faqat h1 va hero raqamlari; sahifada ≤2 marta |
| H2 | Unbounded 600 | `clamp(28px, 3.2vw, 44px)` | Seksiya sarlavhasi |
| H3/Karta | Manrope 700 | 20 px | |
| Body | Manrope 400/500 | 16 px, lh 1.55; ilovada 14 px | Max satr uzunligi 68 belgi (o'zbekcha inglizchadan ~20 % uzun) |
| Data | JetBrains Mono 500 | 13–15 px, `font-variant-numeric: tabular-nums` | Vagon raqami, ESR kodi, STIR, summa, vaqt |

Alternativa: Unbounded o'rniga "Space Grotesk" — arzonroq ko'rinadi, rad. Unbounded'ning keng, salmoqli shakli temir yo'l og'irligini beradi; muammosi — o'zbek sarlavhalari uzun, shuning uchun display faqat 2–4 so'zlik sarlavhaga.

### 1.2 Karvonsaroy motivlari — zamonaviy qo'llash

| Motiv | Qayerda | Qanday | Taqiq |
|---|---|---|---|
| **Ravoq** (arch) | Hero video maskasi (desktop'da ekranning o'ng 55 %), terminal kartasi rasmi, mobil rol kartasi | `clip-path`/`border-radius: var(--radius-arch)`; ravoq ichida video, tashqarisida navy | Har kartaga ravoq emas — 1 ekran = 1 ravoq |
| **Girih** (8-burchakli yulduz to'ri) | Seksiya foni, xat blankasi vodyanoy belgisi, 404 | Bitta SVG `<pattern>` (64×64 tile, 1.5 px stroke, `--rail` rang, opacity .06 light / .08 dark) | Rangli girih, gradient girih — yo'q |
| **Gumbaz** | Loader/progress ring (yarim doira), slot sig'imi indikatori | 180° arc, `stroke-dasharray` | Illyustratsiya sifatida gumbaz — yo'q |
| **Karvon yo'li** | Marshrut chizig'i (xarita, buyurtma timeline) | `stroke-dasharray: 2 6`, `stroke-dashoffset` animatsiyasi (harakat yo'nalishi) | |
| **Naqsh ranglari** (lojuvard/feruza/oltin) | Bu allaqachon palitra: navy = lojuvard, teal = feruza, amber = oltin | Yangi rang qo'shilmaydi | |

### 1.3 Anti-generic qoidalar (AI-slop belgilari → nima qilinadi)

1. Binafsha-ko'k gradient tugma → faqat teal solid, hover'da `--teal-ink`.
2. Glassmorphism kartalar (`backdrop-filter: blur`) → hech qayerda; faqat hero navbar'da 1 ta `blur(12px)`.
3. 3 ta bir xil ikonkali "feature" kartalari → har kartada real skrinshot/mikro-demo (slot kalendari, narx formulasi).
4. Lucide ikonkalar 24 px teal doirada → ikonka doirasiz, 20 px, matn rangida.
5. Stok "delivery" 3D illyustratsiya (Blush/Storyset) → faqat o'z videosi/3D'si yoki real foto (Sergeli, Toshkent-tovar).
6. "Trusted by 10 000+ companies" → real raqam: **18 428 mijoz reestrda, 7 056 stansiyaga biriktirilgan** (Ish standarti §07).
7. Har seksiyada fade-up animatsiya → faqat 3 xoreografiyalangan seksiya (4-bo'lim).
8. Rounded 24 px hamma joyda → 6/12/20 tizimi.
9. Emoji sarlavhalar (demo'dagi "📱 Мобил илова") → ishlab chiqarishda ikonka.
10. "Lorem"/"Yangi avlod platformasi" tipidagi gaplar → har sarlavha fe'l + raqam: "3 daqiqada terminal top", "30 daqiqalik SLA".
11. Markazlangan hamma narsa → hero chapga tekislangan, asimmetrik 7/5 grid.
12. Cheksiz hero balandligi → hero 100 svh, birinchi ekranda CTA va 3 ta ishonch belgisi ko'rinadi (1366×768 laptop'da tekshiriladi).

### 1.4 Logo yo'nalishi (3 variant, Figma'da sinash)

- **A "Ravoq + rels"**: ravoq konturi, ichida ikki parallel chiziq (rels) perspektivada gumbaz nuqtasiga ketadi; so'zbelgi "YukSaroy" Unbounded 600. Tavsiya.
- **B "YS monogram"**: Y va S bitta uzluksiz relsdek chiziq; favicon uchun kuchli.
- **C "Konteyner-girih"**: 8-burchak yulduz ichida konteyner — ko'p detal, 16 px'da o'qilmaydi, rad.
Mono (1 rang), teal/navy, oq versiyalari; minimal o'lcham 24 px; himoya maydoni = ravoq balandligining ½.

## 2. Landing sahifa (AIDA)

| # | Seksiya | Maqsad | Sarlavha (uz) | Vizual | Animatsiya |
|---|---|---|---|---|---|
| 1 | **Hero** (Attention) | 5 s ichida "bu temir yo'l, bu zamonaviy, bu ishlaydi" | "Yuk saroyini 3 daqiqada toping, band qiling, kuzating" · subtitle: "O'zbekiston temir yo'l terminallarining yagona platformasi" · CTA: "Terminal topish" / "Terminal sifatida qo'shilish" | Ravoq ichida video; chapda matn; pastda 3 belgi: `18 428 mijoz · 30 daq SLA · ERI hujjat` | Video loop; sarlavha so'zma-so'z 240 ms/stagger 40 ms; scroll'da video → 3D xarita (pin 200 vh) |
| 2 | **Muammo → Yechim** (Interest) | "Qo'ng'iroq va qog'oz" ni ko'rsatish | "Hozir: 6 qo'ng'iroq, 2 kun. YukSaroy'da: 1 buyurtma, 3 daqiqa" | Chapda telefon/qog'oz ikonkalari xira, o'ngda ilova kartasi | Split-screen, scrub bilan chap tomon xira bo'ladi |
| 3 | **Qanday ishlaydi** | 8 qadamni 3 ga siqish | "Buyurtma → Slot → Yuklash" | 3 karta gorizontal pin, har biri jonli mini-UI (vizard, kalendar, timeline) | Horizontal scroll pin (300 vh) |
| 4 | **Tarmoq xaritasi 3D** (Desire) | "Butun O'zbekiston bitta ekranda" | "Urganch'dan Sergeli'gacha — har bir terminal paspоrti bilan" | R3F sahna (3-bo'lim), o'ngda terminal kartasi hover'da | Kamera scrub'da 5 nuqta bo'ylab uchadi |
| 5 | **Raqamlar** | Ishonch | 18 428 · 7 056 · 6 daromad oqimi · 3 ish kuni (TY kod) | 4 ta katta Unbounded raqam, JetBrains sublabel | Counter 700 ms, faqat 1 marta |
| 6 | **Rollar** | Har kim o'zini topsin | 7 rol (logist, haydovchi, terminal, vagon egasi, deklarant, ekspeditor, lokomotiv) | Tab'lar + mobil ekran mockup (ravoq maskada) | Tab almashinuvi 160 ms crossfade |
| 7 | **Aktivlar bozori tizeri** | Noyob funksiya | "Shahobcha yo'l, vagon, teplovoz — bitta bozor" | Shahobcha yo'l sxemasi (demo `spurMap`) interaktiv | Hover'da yo'l amber |
| 8 | **Ishonch qatlami** | Xavfni olib tashlash | "Eskrou · ERI · Arbitraj 3 kun · Audit izi" | 4 chip + stansiya xatining preview'i | Yo'q (statik) |
| 9 | **CTA** (Action) | Konversiya | "Pilotga 0 % komissiya bilan qo'shiling" | Telefon raqami + SMS (Ish standarti §01) | Tugma magnetic ≤8 px |
| 10 | Footer | | Manzil, O'TY hamkorlik, uz/ўз/ru | Girih fon .06 | |

### 2.1 Hero video — storyboard (10 s, 24 fps, 240 kadr, seamless loop)

| Vaqt | Kadr | Kamera | Rang/yorug'lik | Overlay (HTML, videoda emas) |
|---|---|---|---|---|
| 0.0–2.0 s | Tong, tuman, relslar ustidan past uchish | Dron 3 m balandlik, oldinga 2 m/s | Soyalar teal (#0D1C2F→#0E9384), yorug'lik amber (#E0A24A) | Sarlavha kiradi |
| 2.0–4.5 s | Terminal: richstacker 40 ft konteynerni ko'taradi, orqada gantri kran | Crane-up 3→12 m, yengil orbit | Quyosh gorizontda, lens flare yo'q | 3 ishonch belgisi |
| 4.5–7.0 s | Yarim vagonlar qatori yonidan o'tish, bitta vagon raqami fokusda | Lateral dolly 1.5 m/s | | JetBrains Mono'da o'sha raqam paydo bo'ladi, "Vagon 62 t · Slot 10:00–12:00" chip |
| 7.0–9.0 s | Vagonlar yuqoridan, rels chiziqlari — tarmoq sxemasiga o'xshaydi | Tilt-down, 40 m | Rang teal'ga siljiydi | Teal chiziqlar rels ustida chiziladi (Canvas) — 3D xaritaga ko'prik |
| 9.0–10.0 s | Tumanga dissolve → 0 kadrga qaytish | Statik | Tuman #0D1C2F 80 % | Overlay statik |

Loop tikishi: 9–10 s va 0–1 s bir xil tuman qatlamiga ega — dissolve seam ko'rinmaydi. Mobil (1080×1920) uchun alohida kompozitsiya: kadr 2 va 3 vertikal reframe (Higgsfield `reframe` yoki ffmpeg `crop`), 8 s.

### 2.2 Texnik spetsifikatsiya

| Parametr | Desktop | Mobil |
|---|---|---|
| O'lcham / fps / uzunlik | 1920×1080 / 24 / 10 s | 1080×1920 / 24 / 8 s |
| Formatlar (`<source>` tartibi) | 1) `video/mp4; codecs=av01.0.08M.08` (AV1, Chrome/Edge/Firefox) 2) `video/mp4; codecs=hvc1` (HEVC, Safari) 3) `video/webm; codecs=vp9` 4) H.264 baseline fallback | bir xil |
| Hajm | AV1 ≤1.8 MB, HEVC ≤2.5 MB, VP9 ≤2.5 MB (≈2 Mbit/s) | ≤1.5 MB |
| Poster | AVIF ≤60 KB + JPEG ≤120 KB (`<picture>` emas — `poster` faqat bitta URL: AVIF'ni server content-negotiation bilan bering yoki JPEG) | |
| Atributlar | `autoplay muted playsinline loop preload="none" poster disablepictureinpicture` | |
| Yuklash | LCP = poster. Video `IntersectionObserver` + `requestIdleCallback` dan keyin `src` qo'yiladi (hero ko'rinishda bo'lsa) | |
| Reduced motion | `matchMedia('(prefers-reduced-motion: reduce)')` → video umuman yuklanmaydi, poster + "Videoni yoqish" tugmasi | |
| Sekin tarmoq | `navigator.connection.saveData === true` yoki `effectiveType` ∈ {2g, 3g} → poster | |
| Audio | Yo'q (AI modellar native audio beradi — `-an` bilan olib tashlanadi) | |

AV1 haqida fakt: Safari AV1 faqat apparat dekoderli qurilmalarda (iPhone 15 Pro+, M3+), dasturiy dekoder yo'q — shuning uchun HEVC ikkinchi manba majburiy.

ffmpeg (bir marta, `scripts/video.sh`):
```
ffmpeg -i hero.mov -an -vf "scale=1920:1080,fps=24" -c:v libsvtav1 -crf 38 -preset 6 -g 240 -pix_fmt yuv420p hero.av1.mp4
ffmpeg -i hero.mov -an -vf "scale=1920:1080,fps=24" -c:v libx265 -crf 28 -tag:v hvc1 -movflags +faststart hero.hevc.mp4
ffmpeg -i hero.mov -an -vf "scale=1920:1080,fps=24" -c:v libvpx-vp9 -crf 34 -b:v 0 -row-mt 1 hero.vp9.webm
ffmpeg -i hero.mov -frames:v 1 -vf "scale=1920:1080" -c:v libaom-av1 -still-picture 1 poster.avif
```

### 2.3 Generatsiya usullari — solishtirish va tavsiya

| Usul | Muddat | Xarajat | Sifat/xavf |
|---|---|---|---|
| AI video (Higgsfield orqali Kling 3.0 / Veo 3.1) | 1–2 kun | $15–60/oy obuna | Realistik, lekin O'TY vagonlari (12-132 polu-vagon, "УТЙ" yozuvi) noto'g'ri chiqishi mumkin — "generic konteyner terminali" bo'lib qoladi |
| Real dron (Sergeli / Toshkent-tovar) | 1 hafta (ruxsat + suratga olish) | Operator 1 kun | Eng ishonchli, "bizniki" degan his; O'TY xavfsizlik xizmati va dron uchish ruxsati kerak — MVP'ni to'xtatmasin |
| Blender 3D render | 2–3 hafta | Artist | Faqat vagon glTF modeli uchun mantiqli, video uchun emas |

**Tavsiya:** F1 (MVP) — AI video (Kling 3.0 multi-shot storyboard uchun, Veo 3.1 1–2 hero kadri uchun), F2 — real dron tasviri bilan almashtirish; Blender — faqat 3D vagon modeli.

Tayyor promptlar (inglizcha — modellar shunday yaxshi ishlaydi; `--no text, no logos, no people faces`):

**Prompt 1 — Veo 3.1 (kadr 1–2, realistik hero):**
`Cinematic aerial drone shot at dawn over a Central Asian railway freight terminal, low altitude gliding forward along steel rails with thin morning fog, then craning up to reveal a reach stacker lifting a 40-foot container beside a gantry crane; teal-blue shadows and warm amber sunrise highlights, dry steppe landscape, Soviet-era brick warehouse in background, photoreal, 24fps, smooth stabilized camera, no text, no logos, no people.`

**Prompt 2 — Kling 3.0 (multi-shot, 4 sahna, loop uchun):**
`Multi-shot sequence, 10 seconds, seamless loop: Shot 1 — foggy dawn, camera glides 3 m above railway tracks toward a freight yard. Shot 2 — crane-up past open-top gondola wagons loaded with coal and grain, a reach stacker moving a container. Shot 3 — lateral dolly along a row of gondola wagons, one wagon number plate in sharp focus. Shot 4 — tilt down from 40 m, rail lines form a network pattern, dissolve into the same fog as shot 1. Color grade: deep navy shadows, teal midtones, amber highlights. Photoreal, no text, no logos, no people.`

**Prompt 3 — Higgsfield (kamera preset "Crane Up" + "Dolly Left", 5 s, mobil vertikal):**
`Vertical 9:16, Uzbekistan railway freight terminal at golden hour, gantry crane silhouette, gondola wagons in a row, reach stacker with container, subtle dust in the air, teal and amber color grade, slow crane-up camera, photoreal, no text.`

Har prompt'dan 4 variant, eng yaxshisi `upscale_video` bilan 1080p→4K, keyin ffmpeg. Vagon detallarini to'g'rilash uchun `generate_image` bilan avval 3 ta key-art (referens) yaratib, video'ga image-to-video sifatida bering — "generic" xavfini kamaytiradi.

## 3. 3D effektlar (React Three Fiber)

### 3.1 Asosiy sahna — `RailNetwork3D`

Ma'lumot: `ЕСР с новыми станциями.xlsx` + railmap JSON → `scripts/build-railmap.ts` → `public/data/railmap.min.json` (`{stations:[{id,esr,name,x,y,terminal:bool}], edges:[[a,b],…]}`; lat/lon → tekislik: `d3-geo` `geoMercator().center([64, 41.5])`, ≤80 KB gzip).

Komponent daraxti:
```
<Canvas dpr={[1,1.5]} frameloop="demand" gl={{antialias:false, powerPreference:'high-performance'}}>
  <ScrollCamera path={curve5pts} progress={scrollProgress}/>   // CatmullRomCurve3, 5 kalit: Toshkent tuguni → Qo'qon → Buxoro-2 → Urganch → Nukus (reestrdagi eng ko'p mijozli stansiyalar)
  <CountryOutline/>          // GeoJSON → THREE.Shape → ExtrudeGeometry depth 0.4, navy, 1 draw call
  <RailLines/>               // drei <Line> (Line2), barcha edges bitta geometriyada, teal, 1 draw call
  <Stations/>                // InstancedMesh (sphere r=.02), N ta stansiya, 1 draw call
  <Terminals/>               // 20 ta sprite + custom shader pulse, additive blending, 1 draw call
  <CargoFlow/>               // Points 5 000, ShaderMaterial (uTime, uProgress), edges bo'ylab oqim, 1 draw call
  <EffectComposer enabled={!isMobile}><Bloom intensity={.6} luminanceThreshold={.8}/></EffectComposer>
</Canvas>
```
Jami ≈6–8 draw call, ≈40 k uchburchak. Terminal hover → `useCursor` + HTML `<Html>` karta emas — DOM'dagi karta (`onPointerOver` → React state), chunki `<Html>` scroll'da sakraydi.

Shaderlar (2 ta, ko'p emas):
1. **Rail pulse** (fragment): `uv.x` bo'ylab `smoothstep(p-.02, p, uv.x) * (1-smoothstep(p, p+.02, uv.x))`, `p = fract(uTime*.15)` — teal yorug'lik relsda "yuk" bo'lib yuradi; `fwidth` bilan AA.
2. **Terminal glow** (sprite): radial `1-smoothstep(0,.5,d)` × `0.7+0.3*sin(uTime*2+uSeed)` — har terminal boshqa fazada pulsatsiya.

### 3.2 Alternativ/qo'shimcha: vagon modeli

Polu-vagon 12-132 glTF: Blender'da ≤12 k uchburchak, KTX2 tekstura 1024², Draco (`gltf-transform optimize --compress draco`) ≤300 KB. Higgsfield `generate_3d` (image→3D) faqat konsept uchun — topologiyasi tozalanmagan, ishlab chiqarishga Blender. Qayerda: "Rollar" seksiyasida vagon egasi tab'ida, sekin aylanadi (`useFrame` da 0.1 rad/s), `frameloop="demand"` + `invalidate()` faqat ko'rinishda.

### 3.3 Performance byudjeti va fallback

| Chegara | Qiymat | Nazorat |
|---|---|---|
| Draw call | ≤60 (sahna 8) | `gl.info.render.calls` dev overlay |
| Uchburchak | ≤150 k | |
| Tekstura | ≤2 × 1024² KTX2 | |
| JS (three + r3f + drei chunk) | ≤220 KB gzip, `next/dynamic({ssr:false})`, hero ko'rinishida + LCP'dan keyin | `@next/bundle-analyzer` |
| Kadr | 60 fps desktop, 30 fps mobil o'rta | `r3f-perf` dev |
| DPR | `[1, 1.5]` | |
| Fallback shartlari | WebGL2 yo'q · `hardwareConcurrency < 4` · `deviceMemory < 4` · viewport < 768 · reduced-motion · `saveData` | → `<picture>` WebP 1600 px (xaritaning render'i) + CSS `transform: translateY(var(--scroll)*.1)` parallax |

### 3.4 Spline vs Three.js vs R3F

| | Spline | Three.js (vanilla) | R3F 9.7 + drei |
|---|---|---|---|
| Ma'lumotga bog'lash (railmap JSON, 20 terminal holati) | Qiyin (embed API cheklangan) | To'liq | To'liq, deklarativ |
| Runtime hajmi | ≈1.5 MB+ | ≈170 KB gz | ≈200 KB gz |
| React 19 / Next 16 mosligi | iframe/embed | imperativ, `useEffect` ichida | R3F 9 = React 19.0–19.2 rasman |
| Dizayner mustaqil tahrirlashi | Ha | Yo'q | Yo'q (Figma'da referens) |
| Qaror | Faqat konsept/prototip | Rad | **Tanlov** |

## 4. Scroll xoreografiyasi

Stack: Lenis 1.3.25 (`lerp: .1`, `wheelMultiplier: 1`, `syncTouch: false` — iOS'da native) + GSAP 3.13 ScrollTrigger (`lenis.on('scroll', ScrollTrigger.update)`, `gsap.ticker.add(t => lenis.raf(t*1000))`, `lagSmoothing(0)`).

| Seksiya | Trigger | Parametr |
|---|---|---|
| Hero → 3D | `pin: true, end: '+=200%', scrub: .8` | 0–40 %: video opacity 1→0, ravoq maskasi kengayadi (`clip-path` inset → 0); 40–100 %: kamera `progress` 0→1 |
| Qanday ishlaydi | Horizontal pin `+=300%`, `snap: 1/2` | 3 karta `xPercent: -200` |
| Xarita 3D | `scrub: 1`, pin yo'q (hero'da pinlangan) | Terminal kartalari `stagger: .06` |
| Raqamlar | `once: true`, `toggleActions: 'play none none none'` | `gsap.to(obj, {val: 18428, duration: .7, snap: {val: 1}})` |
| Boshqa seksiyalar | `IntersectionObserver` + CSS `@starting-style` | GSAP kerak emas |

Kursor: custom cursor **yo'q** (touch'da ma'nosiz, a11y'da xalaqit). Faqat CTA'da magnetic effekt (≤8 px, `--dur-2`) va 3D'da `pointer` cursor.

**Ehtiyotkorlik chegarasi:** sahifada ≤3 pin, jami pin ≤500 vh; `lerp ≥ .08` (scroll-jacking hissi boshlanadi); `scrub ≥ .6` (kichikroq — silkinadi); PageDown/Space/Tab bilan hamma seksiya erishiladi (Lenis native scroll'da ishlaydi); `prefers-reduced-motion` → `ScrollTrigger.disable()`, Lenis yaratilmaydi, pin'lar oddiy oqimga aylanadi; Lighthouse CLS < 0.05 (pin-spacer balandligi SSR'da rezerv qilinadi).

## 5. Ilova UX (login'dan keyin)

### 5.1 Rol-shell'lar

| Shell | Navigatsiya | O'ziga xos |
|---|---|---|
| Shipper (`/app`) | Chap rail 240 px (yig'ilganda 64 px), 13 band (demo NAVS.ship), yuqorida `⌘K` qidiruv (terminal/stansiya/vagon raqami), rol almashtirgich, `uz/ўз/ru` | Doim ko'rinadigan "Yangi buyurtma" tugmasi |
| Terminal (`/terminal`) | 6 band (NAVS.term) | Yuqori panelda **SLA taymer**: kutayotgan talabnomalar soni + eng yaqin deadline |
| Admin (`/admin`) | 3 band | Xarita-birinchi |
| Mobil (barcha rollar) | Pastki tab bar 5 ta, rolga qarab | Haydovchi: 56 px tugmalar, offline kesh |

### 5.2 Ekran maketlari (matnli wireframe)

**Shipper dashboard** — 12 ustunli grid, 24 px gap:
```
[ 8 ust: "Bugun" — faol buyurtmalar (3 karta: YS-1041 tasdiqlandi 10:00–12:00 · YS-1038 kutilmoqda ⏱ 18 daq) ] [ 4 ust: TY kod balansi (JetBrains) + "To'ldirish" ]
[ 8 ust: Kelayotgan vagonlar (24 soat) — jadval: vagon № · stansiya · ETA · "Tushirish slotini band qilish" ]      [ 4 ust: Yaqin terminallar sig'imi (3 ta mini-gumbaz arc) ]
[ 12 ust: So'nggi hujjatlar (GU-29, SMGS) — chip: Tayyor / Imzo kutilmoqda ]
```

**Terminal katalogi + xarita** — 40/60 split: chapda kartalar (rasm ravoq maskasida 96×72, nom, `24/7` chip, yuklama bar `load %`, reyting, tarif `18 500 so'm/t`), yuqorida chip-filtrlar (hudud, xizmat: Kran 32t, SVX, Konteyner, Tarozi); o'ngda **MapLibre GL** (vektor, bepul; Leaflet'dan farqi — 3D ekstruziya va silliq zoom) terminal markerlari; karta hover ↔ marker highlight ikki tomonlama. Mobil: xarita pastki sheet.

**Buyurtma vizardi (3 qadam)** — yuqorida stepper, o'ngda sticky xulosa:
1. Yuk: yo'nalish (Mahalliy/Import), operatsiya (Yuklash/Tushirish/Bo'sh vagon), yuk turi (ETSNG qidiruv), vazn (t), vagon № (tushirishda) — VagonFlow'dan `Request` mavjud bo'lsa avtomatik to'ladi.
2. Terminal + slot: katalog qisqartirilgan (3 tavsiya, "yaqin stansiya" bo'yicha) → slot kalendari.
3. Tasdiqlash: narx formulasi ochiq — `62 t × 18 500 = 1 147 000 + Tarozi 120 000 + Platforma 3 % = 1 305 010 so'm`; qo'shimcha xizmatlar (EXTRA) checkbox; "Buyurtma berish" → 30 daqiqalik SLA taymeri boshlanadi.

**Tayim-slot kalendari** — hafta ko'rinishi, 7 kun × 6 slot (`SLOTS`), katak = 4 segmentli bar (vagon o'rni: teal bo'sh, amber 1 qoldi, `--faint` to'la), hover'da "Kran 32 t · 2 brigada"; tanlangan slot boshqalarga 10 daqiqa "hold" (`--warn` chegara, countdown). Mobil: kun tanlash → vertikal ro'yxat.

**Buyurtma holati timeline** — vertikal 8 qadam (Ish standarti §02): har qadamda aktor chipi (Mijoz/Tizim/Terminal), vaqt tamg'asi, SLA halqasi (30 daq → 2–4 soat), demurraj taymeri tushirishda ochiq; karvon yo'li chizig'i bajarilgan qadamlar orasida animatsiyalanadi.

**Terminal kabineti** — inbox: talabnomalar deadline bo'yicha tartiblangan, har qatorda countdown (`18:42`), "Qabul" / "Rad (sabab)" — rad etishda sabab majburiy (rating'ga ta'sir). Slot boshqaruvi: kalendarda sig'imni sudrab o'zgartirish (`2.5.7` uchun tugma alternativi ham).

**Stansiya xati konstruktori** — 2 panel: chapda forma (shahobcha yo'l ← `Siding` modeli, korxona/STIR ← `Client`, vagon raqamlari textarea → chip'lar, davr dan–gacha), o'ngda jonli A4 preview (`@page A4`, `--sand-soft` qog'oz, girih vodyanoy, blanka, stansiya boshlig'i nomiga murojaat, vagon jadvali JetBrains, "qarshi emasman" rozilik bloki ERI tamg'asi bilan, QR — `/verify/{id}`). Tugmalar: "PDF yuklab olish", "ERI bilan imzolash", "Stansiyaga yuborish" → stepper: Yuborildi → Ko'rildi → Ruxsat № → DSP topshirig'i.

**Aktivlar bozori** — MapLibre: shahobcha yo'llar polyline (`Siding.lengthM`, `capacityWagons`, `occupiedWagons` — VagonFlow'da bor), rangi rejim bo'yicha (Ijara teal / Sotuv amber / Xizmat faint); klik → o'ng drawer (paspоrt + "Stansiyaga xat" tugmasi).

**Mobil rol ekranlari** — Haydovchi: "Bugungi reys" bitta karta, katta "Yetib keldim" tugma, yo'l servislari ro'yxati, offline; Logist: buyurtmalar + push; Terminal egasi: bugungi slotlar + talabnomalar countdown.

## 6. Mikro-interaksiyalar va motion tizimi

Tokenlar: `--dur-1 80` (hover, chip), `--dur-2 160` (tugma, toggle), `--dur-3 240` (karta, drawer), `--dur-4 400` (modal, sahifa o'tish), `--dur-5 700` (faqat landing counter/hero). Easing yuqorida. Ilovada `--dur-5` taqiqlanadi.

1. Tugma bosish: `scale(.98)` 80 ms, qo'yib yuborganda `--ease-emph` 160 ms.
2. Slot tanlash: katak teal chegara 160 ms + 4 segment ketma-ket to'ladi (stagger 30 ms).
3. SLA taymer: oxirgi 5 daqiqada halqa amber, 1 daqiqada `--bad` + 2 marta yumshoq puls (reduced-motion'da faqat rang).
4. Buyurtma yuborildi: sticky xulosa timeline'ning 1-qadamiga "uchadi" — View Transitions API (`Link transitionTypes` Next 16'da) 400 ms.
5. Toast (sonner): pastdan 240 ms, 4 s, hover'da to'xtaydi.
6. Vagon № kiritish: 8 raqam to'lganda mono chip'ga aylanadi 160 ms, noto'g'ri nazorat raqami — shake 2×4 px 240 ms.
7. Karta hover (katalog): `translateY(-2px)` + `--shadow-2`, xaritada marker 1.2× 160 ms.
8. Drawer: o'ngdan 240 ms `--ease-emph`, fon `rgba(13,28,47,.4)`; yopilish `--ease-exit` 160 ms.
9. Narx formulasi: qo'shimcha xizmat belgilanganda summa `tabular-nums` bilan 240 ms sanaladi.
10. Xat preview: forma maydoni o'zgarganda preview'dagi o'sha joy 400 ms `--teal-soft` yonadi.
11. Rol almashtirish: sidebar bandlari crossfade 160 ms, layout siljimaydi.
12. Skeleton: 1.2 s shimmer, `--surface`→`--raise`; 300 ms'dan tez javobda skeleton ko'rsatilmaydi (flash oldini olish).

## 7. A11y (WCAG 2.2 AA) va til

- Kontrast: matn 4.5:1, UI komponent 3:1 (1.4.3/1.4.11) — teal-ink/amber-ink qoidasi (1.1).
- Fokus: `outline: 2px solid var(--teal); outline-offset: 2px` + tashqi `--teal-glow` halqa; 2.4.11 *Focus Not Obscured* — sticky header/xulosa ostida fokus qolmasin (`scroll-padding-top: 96px`).
- 2.5.8 *Target Size*: ≥24×24 px, mobil tugmalar 44 px; slot kataklari 48 px.
- 2.5.7 *Dragging*: slot sig'imini sudrash — "+/−" tugma alternativi.
- 3.3.7 *Redundant Entry*: vizardda STIR/korxona qayta so'ralmaydi (profil'dan).
- 3.3.8 *Accessible Auth*: SMS-kod + "kodni qo'yish" (paste) ruxsat, CAPTCHA yo'q.
- Video: `aria-hidden="true"` (dekorativ), matn HTML'da; 3D canvas `role="img" aria-label="O'zbekiston temir yo'l tarmog'i xaritasi, 20 terminal"` + yashirin ro'yxat.
- Reduced motion: barcha `--dur-*` → 0 ms, ScrollTrigger o'chadi, video yuklanmaydi.
- Matn uzunligi: o'zbek lotin inglizchadan ~20–25 % uzun, kirill ~10 % kengroq — tugmalar `min-width` emas, `padding` bilan; jadval ustunlari `text-overflow` emas, wrap. Barcha string'lar `uz/oz/ru` (VagonFlow i18n `uz/oz/ru/en` bilan bir xil kalitlar).
- Kirill/lotin: `<html lang="uz-Latn">` / `uz-Cyrl`; `ʻ` (U+02BB) bir xil ishlatiladi, `'` emas — qidiruv normalizatsiyasi (`Oʻ`→`O'`) backend'da.
- RTL yo'q — `dir="ltr"` qat'iy, logical properties (`margin-inline`) baribir ishlatiladi (arzon).

## 8. Dizayn jarayoni — Figma va MCP

Figma fayl (`YukSaroy · Design`), sahifalar: `00 Cover · 01 Foundations (Variables: color light/dark, type, space, radius, motion) · 02 Components (Button, Chip, Card, Table, Stepper, SlotCell, SLARing, Drawer, Toast) · 03 Patterns (Wizard, Timeline, LetterPreview) · 04 Landing · 05 App-Shipper · 06 App-Terminal · 07 Mobile · 08 Prototype · 09 Handoff`.

Qadam-baqadam (MCP'lar shu sessiyada mavjud):
1. **Tokenlar** — `tokens.json` yoziladi (1.1 jadval) → Figma MCP `create_new_file` → `/figma-use` skill → `use_figma` bilan Variables (2 mode: Light/Dark) yaratiladi; `get_variable_defs` bilan qaytarib tekshiriladi.
2. **Key-art** — Higgsfield MCP `generate_image` (3 ta hero referens: tong terminal, vagon qatori, tarmoq sxemasi), `upscale_image`; natijalar Figma `upload_assets` bilan `04 Landing`ga.
3. **Video** — Higgsfield `generate_video` (Prompt 1–3, image-to-video referens bilan), `reframe` mobil 9:16, `upscale_video`; ffmpeg 2.2 bo'yicha.
4. **3D konsept** — Higgsfield `generate_3d` vagon uchun (faqat referens), Blender'da qayta modellash.
5. **Landing maketi** — HTML prototip (artifact) → Figma MCP `generate_figma_design` → dizayner tuzatadi → `get_design_context` bilan kodga qaytadi; Code Connect (`add_code_connect_map`) Button/Card/SlotCell uchun.
6. **Logo** — Canva MCP `generate-design` 3 variant (1.4), `export-design` SVG; brend kit `create-brand-template-draft`.
7. **Pitch/hujjat** — Gamma `generate` (konsepsiya deck), taqdimotda haqiqiy ekranlar.
8. **Sinov** — Chrome DevTools MCP `lighthouse_audit` (LCP < 2.5 s, CLS < .05, TBT < 200 ms) + `performance_start_trace` scroll paytida (long task ≤50 ms); Playwright MCP 1366×768 va 390×844 skrinshotlar.
9. **Tekshiruv** — 9-bo'lim ro'yxati, keyin `redesign-skill`/`impeccable` audit.

## 9. "Lol qolish" tekshiruv ro'yxati (20 band)

1. Birinchi 1 s: poster (AVIF) ko'rinadi, LCP < 2.5 s (3G'da < 4 s).
2. Video 3 s ichida silliq boshlanadi, loop tikish sezilmaydi (10 marta qarab).
3. Hero'da sarlavha + CTA + 3 ishonch belgisi 1366×768 da fold ustida.
4. Scroll'da video → 3D o'tish uzilishsiz (crossfade + maska), kadr tushishi yo'q (DevTools trace).
5. 3D xaritada o'z stansiyangizni topa olasiz (hover nomi), 20 terminal pulsatsiyada.
6. Mobil (iPhone 12, Android o'rta) — 3D o'rniga WebP parallax, sahifa 30 fps'dan tushmaydi.
7. Reduced-motion'da sahifa to'liq o'qiladi, hech narsa yashirin qolmaydi.
8. Har seksiyada real ekran/ma'lumot — birorta stok illyustratsiya yo'q.
9. Raqamlar haqiqiy (18 428 / 7 056 / 30 daq / 3 ish kuni), manba ko'rsatilgan.
10. Teal matn faqat `--teal-ink`, amber matn faqat `--amber-ink` (kontrast lint o'tdi).
11. Unbounded sahifada ≤2 marta display o'lchamda; o'zbekcha sarlavha 2 qatordan oshmaydi.
12. Ravoq — 1 ekranda 1 ta; girih ≤.08 opacity.
13. Klaviatura bilan hero'dan footer'gacha Tab/PageDown — fokus hech qachon yashirin emas.
14. Custom cursor yo'q, magnetic CTA ≤8 px.
15. JS byudjeti: landing ≤350 KB gzip (3D chunk lazy), ilova shell ≤250 KB.
16. Ilovada hech qanday animatsiya > 400 ms; skeleton 300 ms'dan tez javobda ko'rinmaydi.
17. Vizard 3 qadam, 3 daqiqada tugaydi (5 ta sinovchi, o'rtacha vaqt o'lchanadi).
18. Slot kalendarida sig'im 1 qarashda o'qiladi (rang + segment, faqat rang emas).
19. Stansiya xati preview real A4'da (print → PDF) blanka, QR, ERI bloki bilan to'g'ri chiqadi.
20. Kirill ↔ lotin almashinuvida layout siljimaydi (skrinshot diff < 2 %).

## Manbalar

- GSAP bepul (2025-aprel, Webflow): https://webflow.com/updates/gsap-becomes-free · https://gsap.com/pricing/
- R3F 9 ↔ React 19.0–19.2, v9.7.0: https://www.npmjs.com/package/@react-three/fiber · https://r3f.docs.pmnd.rs/tutorials/v9-migration-guide
- Safari AV1 faqat apparat dekoder (iPhone 15 Pro+): https://bitmovin.com/blog/apple-av1-support/ · https://olliewilliams.xyz/blog/apple-devices-av1-decoding/
- Kling 3.0 / Veo 3.1 / Higgsfield ko'p-modelli platforma: https://higgsfield.ai/blog/5-Best-AI-Video-Models-2026-Tested-Compared · https://similarlabs.com/blog/kling-vs-seedance-vs-veo-3-vs-higgsfield
- Lenis v1.3.25: https://github.com/darkroomengineering/lenis/releases
- Next.js 16: View Transitions (`transitionTypes`), React Compiler stabil, Turbopack default: https://nextjs.org/blog/next-16
- Demo tokenlari: `artifact-8dc58541-1787984976-e276.html` (`--teal/--navy/--amber` light/dark juftliklari, Unbounded 500–700 / Manrope 400–800 / JetBrains Mono 400–600)
