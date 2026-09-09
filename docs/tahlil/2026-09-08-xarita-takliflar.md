# Xarita: holat va kompleks takliflar (2026-09-08)

Manba: 4 yo'nalishli tadqiqot (ko'p tilli plitka manbalari, OSM temir yo'l va avtoyo'l kartografiyasi, standardrail.com / Container xChange / SecurSpace / Truck Parking Club interaksiya modeli, xarita mahsulot sifatida). Har bir fakt plitka metadatasi yoki haqiqiy sahifada tekshirilgan.

## Bugun bajarilgani (hero xaritasi, `apps/web/components/landing/LightMap.tsx`)

- Yozuvlar sayt tiliga ergashadi: uz = `name:uz` yoki `name:latin` yoki `name`, ru = `name:ru`, en = `name_en`. CARTO plitkalarida `name:uz` yo'q, lekin O'zbekiston ichida `name` o'zi lotin o'zbekcha.
- Interaktiv, ustida hech qanday tugma va qoplama yo'q: surish, ikki marta bosish; g'ildirak xarita bosilgandan keyingina yaqinlashtiradi, sichqoncha chiqsa yana sahifani suradi. Telefonda xarita fon, barmoq sahifani suradi.
- Temir yo'l navy (#002352, oq shtrix, tunnel xira), stansiya parklari z13 dan yupqa; avtoyo'l amber (#F39C1F). Positron'ning o'z kulrang temir yo'li yashirilgan.
- Klasterlash: uzoqlashganda yaqin nuqtalar bitta orange doiraga yig'iladi, ichida soni; bosilsa ajraladigan darajagacha yaqinlashadi. Kadr paddingi xaritaning o'zida, shuning uchun markazlash matn ostiga tushmaydi.
- `minZoom 5`, `maxBounds` O'zbekiston va qo'shnilar. Attributsiya matn qatori (ODbL va CARTO shartlari talab qiladi).

Uzoq masshtab yechildi (kun oxirida): CARTO plitkalarida temir yo'l faqat z8 dan bor, shuning uchun z<8 uchun `apps/web/public/data/uz-rail-far.geojson` qo'shildi: OSM Overpass (`railway=rail`, `usage=main|branch`, O'zbekiston hududi, ODbL), 100 m gacha soddalashtirilgan, 128 KB, 4 ta MultiLineString (`u`: m/b, `e`: 0/1). Bu standardrail.com usuli: ular ham uzoq masshtab uchun 288 KB GeoJSON, yaqin uchun 39 MB PMTiles ishlatadi. Yangilash: Overpass so'rovi `scratchpad`dagi `uz-rail-main.overpassql` bilan, oyda bir marta yetarli. 7-taklif endi faqat yaqin masshtab (parklar z11 dan, sanoat liniyalari rangi) uchun qoladi.

## Takliflar (qiymat / mehnat bo'yicha tartiblangan)

| # | Nomi | Mehnat | Bog'liq | Nima beradi |
|---|------|--------|---------|-------------|
| 1 | Xarita API: GeoJSON, `kind` va `accuracy` bilan | S | yo'q | Bitta `GET /map-objects.geojson` hero, `/xarita` va kelajak sahifalarni boqadi. Har obyekt nima ekani (terminal, shahobcha stansiyasi, texnika, yuk mashinasi) va qanchalik aniq joylashgani (`exact` / `station`) UI taxmin qilmasdan ma'lum. |
| 2 | Pin modeli va legenda (qatlam almashtirgich) | S | 1 | Orange nuqta = hozir band qilsa bo'ladigan terminal; teal halqa ichida son = shu stansiya atrofidagi shahobchalar. Legenda bosilsa qatlam yonadi yoki o'chadi. Terminallar DOM havola (klaviatura bilan yetib bo'ladi), shahobchalar klaster. |
| 3 | Hover karta va ko'rinayotgan hudud hisobi | S | 2 | Pin ustida nom, toifa, viloyat, shahobcha soni; "Ko'rinayotgan hududda 4 terminal, 212 shahobcha" pili. Sensorli qurilmada birinchi teginish karta, ikkinchisi sahifa. |
| 4 | Telefon uchun xarita tasmasi va kech yuklash | S | yo'q | lg dan kichikda matn ostida 300px ishlaydigan xarita tasmasi, IntersectionObserver bilan mount, WebGL bekorga yonmaydi. standardrail telefonda hero xaritasini umuman chizmaydi. |
| 5 | Qidiruv va xarita bog'lanishi, "Xaritada ochish" havolasi | S | 1, 2, (6) | Hero qidiruvida yozilgan nom yoki viloyat pinlarni darhol filtrlaydi; joriy kadr bilan to'liq xaritaga havola. Qoida: yozayotganda kamera yuradi, surayotganda yo'q. |
| 6 | `/xarita`: URL holatli to'liq xarita sahifasi | M | 1, 2, 3 | `/ru/xarita?c=69.27,41.29&z=10&cat=terminal,siding&region=UZ-TO` havolasi hamkasbga aynan shu kadr va filtrni qaytaradi. Desktop: chapda 380px ro'yxat; telefon: to'liq ekran xarita, bottom sheet. Header'ga "Xarita". |
| 7 | O'z temir yo'l plitkalari (rail PMTiles, Geofabrik) | M | yo'q | Butun O'zbekiston tarmog'i z4 dan ko'rinadi, sanoat liniyalari magistraldan boshqa rangda, parklar z11 dan, har yo'lning barqaror id si. Aynan standardrail yo'li (bitta PMTiles fayl, server yo'q). Overpass emas, Geofabrik ekstrakti, oyda bir build. |
| 8 | Listing geometriyasi: egasi shahobchani o'zi chizadi | M | 1, 7, Listing | Ro'yxatdagi shahobcha "stansiya atrofida" emas, o'z joyida, ulanish nuqtasi va uzunligi bilan; `accuracy: exact`. Moderatsiya shart, aks holda xarita yolg'on gapiradi. |
| 9 | Texnika va yuk mashinalari qatlamlari | M | 1, 2, Listing | Lokomotiv, vagon (navy kvadrat) va yuk mashinasi (amber romb) e'lonlari xaritada. Transport joylashuvi odatda "bazaviy shahar", shuning uchun `accuracy: city` va shahar markazida klaster. |

## Halollik qoidasi

1335 shahobchaning koordinatasi ular ulanadigan stansiya nuqtasi, shahobchaning o'zi emas. Shuning uchun xarita ularni hech qachon alohida pin qilib chizmaydi: faqat stansiya ustida halqa va son, API da `accuracy: station`, kartada va ro'yxatda "taxminiy joylashuv, stansiya bo'yicha" yozuvi. `near/radius` qidiruvi "stansiyagacha N km" deydi, "shahobchagacha" emas. z13 dan OSM plitkasidan chiqadigan xizmat yo'llari YukSaroy ro'yxati emas, shunchaki OSM geometriyasi: bosilmaydi, hover bermaydi. Stansiyasi yo'q shahobchalar xaritada yo'q, hisob pilida "xaritada ko'rsatilmagan: N" qatori bo'ladi. Egasi aniq geometriya bergan shahobcha (8-taklif) boshqa belgi oladi va faqat shunda "aniq joylashuv" deyiladi. Xaritadagi har bir belgi API dagi `accuracy` maydoniga mos keladi, UI hech qachon o'zi "aniqlashtirmaydi".

## Narx va litsenziya

- Bugun: CARTO `carto.streets` bepul, kalendar oyiga 5 000 000 plitka so'rovi, o'z sayti uchun tijorat ruxsat, plitkani qayta sotish taqiq. Hero bir ko'rinishda 10-20 plitka, ya'ni oyiga 250-500 ming hero ko'rinishiga yetadi. Attributsiya "© CARTO, © OpenStreetMap contributors" har xaritada ko'rinarli bo'lishi shart (shartlar 13-bo'lim). Bepul kalitni hozir olib qo'yish tavsiya (carto.com/basemaps/apikey): raster allaqachon kalit talab qiladi, vektor hali yo'q. `NEXT_PUBLIC_MAP_STYLE` env o'zgaruvchisi bilan manba bir deployda almashadi.
- Zaxira: OpenFreeMap, bepul, limitsiz, kalitsiz, tijorat ruxsat, SLA yo'q. `localize()` va qatlamlar o'zgarmaydi (source id `carto` o'rniga `openmaptiles`).
- O'sish: 5M dan oshsa Protomaps o'zida host (O'zbekiston va qo'shnilar PMTiles bir necha yuz MB, Cloudflare R2 da bitta statik fayl, server yo'q); SLA kerak bo'lsa MapTiler Flex $30/oy yoki Stadia Starter $20/oy (ikkalasining bepul tarifi tijorat uchun taqiqlangan).
- Rad etilganlar: Jawg (€250/oy), Thunderforest (vektor plitka 10x hisoblanadi), VersaTiles (ruscha nom yo'q), Mapbox (token, lock-in). `name:uz` hech bir provayderda yo'q, o'z plitkani qurish yagona yo'l, O'zbekiston ichida `name` allaqachon o'zbekcha bo'lgani uchun arzimaydi.
- 7-taklif temir yo'l plitkasi OSM ODbL ostida, bepul, faqat "© OpenStreetMap contributors" attributsiyasi.
