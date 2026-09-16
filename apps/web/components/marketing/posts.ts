import type { SearchLang } from '@yuksaroy/domain';

// Blog: statik matn, uch til (uz va ru to'liq, en qisqaroq). Har maqola oxirida amal: /map yoki /booking.
export type Block = { h?: string; p?: string; li?: string[] };
export interface Post { slug: string; date: string; cta: '/map' | '/booking'; title: Record<SearchLang, string>; lead: Record<SearchLang, string>; body: Record<SearchLang, Block[]> }

/** O'qish vaqti: 180 so'z / daqiqa, kamida 1. */
export const readMinutes = (blocks: Block[]) => Math.max(1, Math.round(blocks.map((b) => [b.h, b.p, ...(b.li ?? [])].join(' ')).join(' ').split(/\s+/).length / 180));

export const POSTS: Post[] = [
  {
    slug: 'terminal-vs-siding',
    date: '2026-09-01',
    cta: '/map',
    title: { uz: "Terminal va shahobcha yo'l farqi", ru: 'Чем терминал отличается от подъездного пути', en: 'Terminal vs private siding' },
    lead: {
      uz: "Ikkalasi ham vagon qabul qiladi, lekin biri xizmat sotadi, ikkinchisi korxonaning o'z yo'li. Qaysi biri sizga kerakligi yukning keyingi qadamiga bog'liq.",
      ru: 'Оба принимают вагоны, но один продаёт услугу, а другой является собственным путём предприятия. Что нужно вам, зависит от следующего шага груза.',
      en: 'Both receive wagons, but one sells a service and the other is a company\'s own track. Which one you need depends on the next step of the cargo.',
    },
    body: {
      uz: [
        { h: 'Terminal nima', p: "Terminal (yuk saroyi, konteyner terminali, logistika markazi yoki bojxona ombori) xizmat sotadi: yuklash, tushirish, tarozi, saqlash, konteyner bilan ishlash, ba'zida manevr. Uning tarifi bor, ish vaqti bor, bugun qancha buyurtma qabul qila olishi (slotlar) bor. YukSaroyda terminal sahifasini egasi o'zi yuritadi: tariflar, oynalar va bronlar kabinetda." },
        { h: "Shahobcha yo'l nima", p: "Shahobcha yo'l (ruscha подъездной путь) stansiyadan korxona hududiga kiradigan xususiy temir yo'l. Egasi zavod, elevator, ombor yoki neft bazasi. U xizmat sotmasligi mumkin, lekin vagonni o'z hududida qabul qiladi: yuk to'g'ridan-to'g'ri omborga tushadi, terminal bosqichi yo'q. Reestrimizda yo'llar stansiya va uzel bo'yicha yig'ilgan, koordinata uzel darajasida, taxminiy." },
        { h: 'Qachon qaysi biri', li: ["Yukni tez qayta ishlash, tarozi, konteyner almashish kerak: terminal.", "Vagon o'z omboringizga to'g'ri kelsin: shahobcha yo'l, o'zingizniki yoki qo'shni korxonaniki, kelishuv bilan.", "Bojxona rasmiylashtiruvi: bojxona ombori.", "Vagonni bir necha kun ushlab turish: terminal ombori yoki egasi rozi bo'lgan shahobcha yo'l."] },
        { h: 'Narx qayerda', p: "Terminal tarifi katalogda ochiq: tonna, vagon, operatsiya yoki kun uchun. Shahobcha yo'l egasi narx e'lon qilmasligi mumkin; u sahifasini da'vo qilib olgach shartlarini yozadi. Ikkalasida ham platforma vositachi emas, narx egasiniki." },
        { h: 'YukSaroyda qanday topiladi', p: "Terminallar katalogida viloyat, xizmat va bugungi slot bo'yicha filtr bor. Shahobcha yo'llar reestrida stansiya nomi bilan qidiriladi. Xaritada ikkalasi bitta qatlamda: terminallar belgi bilan, yo'llar uzel nuqtasi bilan." },
      ],
      ru: [
        { h: 'Что такое терминал', p: 'Терминал (грузовой двор, контейнерный терминал, логистический центр или таможенный склад) продаёт услугу: погрузка, выгрузка, взвешивание, хранение, работа с контейнерами, иногда маневровая работа. У него есть тариф, часы работы и число заказов, которое он может принять сегодня (слоты). На YukSaroy страницу терминала ведёт сам владелец: тарифы, окна и брони в кабинете.' },
        { h: 'Что такое подъездной путь', p: 'Подъездной путь (uz. shahobcha yo\'l) это частная железнодорожная ветка от станции на территорию предприятия. Владелец завод, элеватор, склад или нефтебаза. Он может не продавать услуг, но принимает вагон на своей территории: груз попадает прямо на склад, без терминального этапа. В нашем реестре пути собраны по станциям и узлам, координата на уровне узла, приблизительная.' },
        { h: 'Когда что нужно', li: ['Быстро обработать груз, взвесить, перегрузить контейнер: терминал.', 'Вагон должен прийти прямо на ваш склад: подъездной путь, свой или соседнего предприятия по договорённости.', 'Таможенное оформление: таможенный склад.', 'Подержать вагон несколько дней: склад терминала или путь владельца, который согласен.'] },
        { h: 'Где цена', p: 'Тариф терминала открыт в каталоге: за тонну, вагон, операцию или сутки. Владелец подъездного пути может не публиковать цену; получив страницу по заявке, он пишет условия сам. В обоих случаях платформа не посредник, цена принадлежит владельцу.' },
        { h: 'Как найти на YukSaroy', p: 'В каталоге терминалов есть фильтры по региону, услуге и свободным слотам на сегодня. В реестре подъездных путей ищут по названию станции. На карте оба в одном слое: терминалы значком, пути точкой узла.' },
      ],
      en: [
        { h: 'Terminal', p: 'A terminal (freight yard, container terminal, logistics center or bonded warehouse) sells a service: loading, unloading, weighing, storage, container handling. It has a tariff, opening hours and a number of orders it can take today (slots). On YukSaroy the owner runs the terminal page from the dashboard.' },
        { h: 'Private siding', p: 'A private siding is a rail track from the station into a company\'s premises: a plant, a grain elevator, a warehouse. It may sell no service at all, but it receives the wagon on its own ground, so the cargo lands straight in the warehouse. Our registry lists sidings by station and node; coordinates are approximate, node level.' },
        { h: 'Which one', li: ['Fast handling, weighing, container transfer: terminal.', 'Wagon straight to your warehouse: a siding, yours or a neighbour\'s by agreement.', 'Customs clearance: a bonded warehouse.'] },
        { h: 'On YukSaroy', p: 'The terminal catalog filters by region, service and free slots today. The sidings registry is searched by station name. The map shows both in one layer.' },
      ],
    },
  },
  {
    slug: 'wagon-rent',
    date: '2026-09-03',
    cta: '/map',
    title: { uz: 'Vagon ijarasi qanday ishlaydi', ru: 'Как работает аренда вагонов', en: 'How wagon rent works' },
    lead: {
      uz: "Xususiy vagon egasi bo'sh vagonni oyiga yoki kuniga beradi. E'londa nimaga qarash, narx birligi nima va so'rov qanday yuboriladi.",
      ru: 'Частный владелец отдаёт свободный вагон помесячно или посуточно. На что смотреть в объявлении, что такое единица цены и как отправить запрос.',
      en: 'A private owner rents an idle wagon per month or per day. What to check in a listing, what the price unit means and how to send an inquiry.',
    },
    body: {
      uz: [
        { h: 'Kim beradi', p: "Xususiy vagon egalari va operatorlar. Ular vagon bo'sh turgan davrda uni ijaraga beradi: yopiq vagon, yarim vagon, platforma, sisterna, xopper yoki refrijerator. YukSaroyda bunday e'lonlar Texnika bo'limida, har biri egasining sahifasi bilan." },
        { h: 'Narx birligi', li: ["Oyiga: uzoq muddatli ijara, eng keng tarqalgan birlik.", "Kuniga: qisqa muddat, bir necha reys uchun.", "Jami: bu sotuv e'loni, ijara emas.", "Narx so'rov bo'yicha: egasi narxni yozmagan, so'rov yuborib bilib olasiz."] },
        { h: "E'londa nimaga qarash", li: ["Yil va holat: yangi, yaxshi yoki ta'mir talab. Standart bo'yicha bu majburiy maydon.", "Sig'im (tonna) va soni: bir nechta vagon bo'lsa e'lon bitta, soni ko'rsatiladi.", "Qayerda turibdi: viloyat, agar bog'langan bo'lsa terminal yoki shahobcha yo'l.", "Egasining KYC belgisi: STIR tasdiqlangan tashkilot.", "Javob vaqti: egasi aytgan, platforma o'lchamagan."] },
        { h: 'Jarayon', p: "E'lonni ochasiz, narx ochiq. So'rov yuborish va telefonni ko'rish uchun kabinet kerak: telefon yoki Google orqali bir daqiqa. Egasi so'rovga o'z kabinetida javob beradi, shartnoma va to'lov platformadan tashqarida. Platforma vositachi emas, ijaradan komissiya olmaydi." },
        { h: "Egasi bo'lsangiz", p: "E'lon berish bepul, 90 kun faol turadi. Standart bo'yicha tekshiruv formada ko'rinadi: majburiy maydon to'lmasa e'lon chiqmaydi. Premium e'lonni ro'yxatda va xaritada yuqoriga chiqaradi, ko'rsatkichlar ochiladi." },
      ],
      ru: [
        { h: 'Кто сдаёт', p: 'Частные владельцы вагонов и операторы. Пока вагон простаивает, его сдают в аренду: крытый, полувагон, платформа, цистерна, хоппер или рефрижератор. На YukSaroy такие объявления в разделе Техника, у каждого страница владельца.' },
        { h: 'Единица цены', li: ['В месяц: долгосрочная аренда, самая частая единица.', 'В сутки: короткий срок, на несколько рейсов.', 'Итого: это объявление о продаже, а не аренде.', 'Цена по запросу: владелец не указал цену, узнаёте запросом.'] },
        { h: 'На что смотреть в объявлении', li: ['Год и состояние: новый, хороший или требует ремонта. По стандарту это обязательное поле.', 'Грузоподъёмность (тонн) и количество: несколько вагонов оформляются одним объявлением с указанием числа.', 'Где стоит: регион, и если привязан, терминал или подъездной путь.', 'Значок KYC владельца: организация с подтверждённым ИНН.', 'Время ответа: заявлено владельцем, платформой не измерено.'] },
        { h: 'Процесс', p: 'Открываете объявление, цена видна. Чтобы отправить запрос и увидеть телефон, нужен кабинет: минута по телефону или через Google. Владелец отвечает на запрос в своём кабинете, договор и оплата вне платформы. Платформа не посредник и комиссию с аренды не берёт.' },
        { h: 'Если вы владелец', p: 'Размещение бесплатно, объявление активно 90 дней. Проверка по стандарту видна в форме: без обязательного поля объявление не выйдет. Премиум поднимает объявление в списке и на карте, открываются показатели.' },
      ],
      en: [
        { h: 'Who rents out', p: 'Private wagon owners and operators. While a wagon stands idle they rent it out: covered, gondola, flat, tank, hopper or reefer. On YukSaroy these listings live under Equipment, each with the owner\'s page.' },
        { h: 'Price unit', li: ['Per month: long-term rent, the most common unit.', 'Per day: short term, a few trips.', 'Total: that is a sale, not rent.', 'On request: the owner did not set a price; ask with an inquiry.'] },
        { h: 'What to check', li: ['Year and condition: required by the listing standard.', 'Capacity in tons and quantity.', 'Where it stands: region, and a terminal or siding when linked.', 'The owner\'s KYC badge.'] },
        { h: 'Process', p: 'The price is open. An account is needed to send an inquiry and see the phone. The contract and payment happen outside the platform; there is no commission on rent.' },
      ],
    },
  },
  {
    slug: 'svx',
    date: '2026-09-05',
    cta: '/map',
    title: { uz: 'Bojxona ombori nima va kimga kerak', ru: 'Что такое таможенный склад и кому он нужен', en: 'What a bonded warehouse is and who needs it' },
    lead: {
      uz: "Bojxona ombori bu bojxona nazorati ostidagi vaqtincha saqlash joyi, hujjatlarda SVX deb yoziladi. Import yuk rasmiylashtiruv tugaguncha shu yerda turadi. Har terminal bunday ombor emas.",
      ru: 'Таможенный склад, в документах СВХ, это склад временного хранения под таможенным контролем. Импортный груз стоит здесь, пока не завершено оформление. Не каждый терминал таков.',
      en: 'A bonded warehouse, written SVX on paperwork, stores goods under customs control. Imported cargo waits here until clearance is done. Not every terminal is one.',
    },
    body: {
      uz: [
        { h: 'Atama', p: "SVX ruscha склад временного хранения qisqartmasi, o'zbekcha vaqtincha saqlash ombori. Bu bojxona organi ruxsati bilan ishlaydigan ombor: tovar bojxona rasmiylashtiruvi tugaguncha shu yerda saqlanadi va nazorat ostida turadi. Litsenziyasiz oddiy ombor bojxona ombori bo'la olmaydi." },
        { h: 'Kimga kerak', li: ["Import qiluvchilar: yuk keldi, deklaratsiya hali topshirilmagan yoki tekshiruvda.", "Eksport qiluvchilar: jo'natishdan oldin nazorat va hujjat to'plash.", "Ekspeditor va deklarantlar: mijoz yukini rasmiylashtiruv davrida qaerda saqlashni hal qiladi.", "Tranzit yuk: ma'lum vaqt kutishi kerak bo'lganda."] },
        { h: 'Terminaldan farqi', p: "Bojxona ombori terminalning bir turi, bojxona ruxsati bilan. Konteyner terminali yoki yuk saroyi yuklash va tushirishni qiladi, lekin bojxona nazorati ostida saqlash huquqi bo'lmasligi mumkin. Katalogda u alohida tur (Bojxona omborlari filtri) va alohida xizmat sifatida chiqadi: terminal bu xizmatni ko'rsatsa, tarifda Bojxona ombori qatori bo'ladi." },
        { h: 'Narx', p: "Odatda kun uchun tarif, ba'zida tonna yoki vagon uchun. Bojxona rasmiylashtiruvi cho'zilsa saqlash kunlari ko'payadi, shuning uchun kunlik tarif va minimal summa muhim. Katalogda tarif ochiq, narx hisobida kunlar sonini kiritib jami summani ko'rasiz." },
        { h: 'Qanday topiladi', p: "Terminallar katalogida Bojxona omborlari filtri yoki xaritada bojxona ombori belgisi. Viloyat va bugungi bo'sh slot bo'yicha filtr ishlaydi. Yordamchi qidiruvga «SVX Toshkent» deb yozsangiz ham shu filtr qo'yiladi." },
      ],
      ru: [
        { h: 'Термин', p: 'СВХ это склад временного хранения. Он работает с разрешения таможенного органа: товар хранится здесь под контролем, пока не завершено таможенное оформление. Обычный склад без лицензии таможенным складом быть не может.' },
        { h: 'Кому нужен', li: ['Импортёрам: груз прибыл, декларация ещё не подана или на проверке.', 'Экспортёрам: контроль и сбор документов перед отправкой.', 'Экспедиторам и декларантам: решают, где хранить груз клиента на время оформления.', 'Транзитному грузу, которому нужно подождать.'] },
        { h: 'Отличие от терминала', p: 'Таможенный склад это один из типов терминала, с таможенным разрешением. Контейнерный терминал или грузовой двор грузит и выгружает, но права хранить под таможенным контролем может не иметь. В каталоге он выделен как отдельный тип (фильтр Таможенные склады) и как отдельная услуга: если терминал её оказывает, в тарифе есть строка Таможенный склад.' },
        { h: 'Цена', p: 'Обычно тариф за сутки, иногда за тонну или вагон. Если оформление затягивается, дней хранения становится больше, поэтому важны суточный тариф и минимальная сумма. Тариф открыт в каталоге, в расчёте цены вводите число дней и видите итог.' },
        { h: 'Как найти', p: 'В каталоге терминалов фильтр Таможенные склады или значок таможенного склада на карте. Работают фильтры по региону и свободным слотам на сегодня. Если написать помощнику «SVX Toshkent», он поставит тот же фильтр.' },
      ],
      en: [
        { h: 'The term', p: 'SVX stands for the Russian "sklad vremennogo khraneniya", a temporary storage warehouse licensed by customs. Goods wait here under control until clearance is complete. A plain warehouse without the licence cannot be one.' },
        { h: 'Who needs it', li: ['Importers whose declaration is not filed or is being checked.', 'Exporters collecting documents before dispatch.', 'Forwarders and brokers deciding where a client\'s cargo waits.'] },
        { h: 'Versus a terminal', p: 'A bonded warehouse is one terminal type with a customs licence. A container terminal or freight yard loads and unloads but may not store under customs control. The catalog shows it as a separate type (Bonded warehouses filter) and as a service with its own tariff line.' },
        { h: 'Price and search', p: 'Usually a daily rate, sometimes per ton or wagon. Tariffs are open in the catalog; use the Bonded warehouses filter or the bonded warehouse marker on the map.' },
      ],
    },
  },
  {
    slug: 'free-slot-today',
    date: '2026-09-08',
    cta: '/booking',
    title: { uz: "Bugungi bo'sh slot nima", ru: 'Что такое свободный слот на сегодня', en: 'What a free slot today means' },
    lead: {
      uz: "Slot terminalning ish oynasi ichida qabul qila oladigan buyurtma joyi. Raqam egasining kabinetidan keladi, Toshkent vaqti bo'yicha bugun uchun.",
      ru: 'Слот это место для заказа внутри рабочего окна терминала. Число приходит из кабинета владельца, на сегодня по ташкентскому времени.',
      en: 'A slot is room for one order inside a terminal\'s working window. The number comes from the owner\'s dashboard, for today in Tashkent time.',
    },
    body: {
      uz: [
        { h: 'Slot nima', p: "Terminal kuniga cheksiz vagon qabul qila olmaydi: kran, tarozi, odamlar va yo'l uzunligi chegara qo'yadi. Shuning uchun egasi ish vaqtini oynalarga bo'ladi (masalan 08:00 dan 12:00 gacha) va har oynada nechta buyurtma qabul qilishini belgilaydi. Bitta buyurtma joyi slot." },
        { h: 'Raqam qayerdan keladi', p: "Egasi kabinetda ish vaqti va oyna sig'imini yozadi. Har tasdiqlangan bron bitta slotni band qiladi. Qolgani katalogda «bugun bo'sh» bo'lib ko'rinadi. Raqam bezak emas: u egasining jadvalidan hisoblanadi va bron qilinganda kamayadi. Egasi jadval yozmagan bo'lsa raqam chiqmaydi, «Bron yo'q» deb ko'rsatiladi." },
        { h: 'Nima uchun muhim', li: ["Kutishsiz yetib kelasiz: oyna sizniki, navbat yo'q.", "Tarif muzlatiladi: buyurtma yuborilganda narx qotadi, keyin o'zgarmaydi.", "Terminal SLA ichida tasdiqlaydi; javob bo'lmasa buyurtma muddati o'tadi va slot bo'shaydi.", "Yakunda akt va hisob-faktura PDF kabinetda, tarozi natijasi bilan."] },
        { h: 'Qanday bron qilinadi', p: "Terminal sahifasida bugungi yoki keyingi kunlardagi oynani tanlaysiz, xizmat, vazn yoki vagon sonini kiritasiz. Buyurtma terminalga boradi va tasdiqlanguncha kutish holatida turadi. Keyin holatlar zanjiri: yetib keldi, tortildi, yuklandi, jo'nadi. Har holatni terminal belgilaydi, siz buyurtma sahifasida ko'rasiz." },
        { h: 'Egasi uchun', p: "Slotlarni ochish bepul. Jadval qancha aniq bo'lsa, katalogdagi raqam shuncha ishonchli va bronlar shuncha ko'p. Bron komissiyasi hozir 0 %; oyiga 100 buyurtmadan oshganda 2 dan 3 % gacha, avval e'lon qilinadi." },
      ],
      ru: [
        { h: 'Что такое слот', p: 'Терминал не может принять бесконечно много вагонов в день: кран, весы, люди и длина пути ставят предел. Поэтому владелец делит рабочее время на окна (например с 08:00 до 12:00) и указывает, сколько заказов принимает в каждом. Одно место для заказа это слот.' },
        { h: 'Откуда число', p: 'Владелец в кабинете задаёт часы работы и вместимость окна. Каждая подтверждённая бронь занимает один слот. Остаток виден в каталоге как «свободно сегодня». Число не декоративное: оно считается из расписания владельца и уменьшается при бронировании. Если расписания нет, число не показывается, стоит «Брони нет».' },
        { h: 'Почему это важно', li: ['Приезжаете без ожидания: окно ваше, очереди нет.', 'Тариф замораживается: при отправке заказа цена фиксируется и больше не меняется.', 'Терминал подтверждает в рамках SLA; без ответа заказ истекает и слот освобождается.', 'В конце акт и счёт-фактура PDF в кабинете, с результатом взвешивания.'] },
        { h: 'Как забронировать', p: 'На странице терминала выбираете окно на сегодня или ближайшие дни, указываете услугу, вес или число вагонов. Заказ уходит терминалу и ждёт подтверждения. Дальше цепочка статусов: прибыл, взвешен, погружен, отправлен. Каждый статус ставит терминал, вы видите его на странице заказа.' },
        { h: 'Для владельца', p: 'Открывать слоты бесплатно. Чем точнее расписание, тем надёжнее число в каталоге и тем больше броней. Комиссия за бронь сейчас 0 %; после 100 заказов в месяц она составит от 2 до 3 %, об этом объявим заранее.' },
      ],
      en: [
        { h: 'The slot', p: 'A terminal cannot take unlimited wagons a day: crane, scale, staff and track length set a limit. So the owner splits working hours into windows (say 08:00 to 12:00) and states how many orders each window takes. One order place is a slot.' },
        { h: 'Where the number comes from', p: 'The owner sets hours and window capacity in the dashboard. Every confirmed booking takes one slot; the rest shows in the catalog as "free today". It is computed from the owner\'s schedule and drops when a booking is made.' },
        { h: 'Why it matters', li: ['No waiting: the window is yours.', 'The tariff freezes when the order is sent.', 'The terminal confirms within the SLA or the order expires and the slot frees up.', 'Act and invoice PDF at the end.'] },
        { h: 'Booking', p: 'On the terminal page pick a window, enter the service and weight or wagon count. The order waits for confirmation, then moves through arrived, weighed, loaded, departed. Booking commission is 0 % today.' },
      ],
    },
  },
];

export const findPost = (slug: string) => POSTS.find((p) => p.slug === slug) ?? null;
