import { JetBrains_Mono, Manrope, Unbounded } from 'next/font/google';

// next/font: build vaqtida yuklanadi, self-host, layout shift yo'q (CLS ≤ .05).
// Bitta nusxa: [locale] layout ham, global-not-found ham shu fayldan oladi. Ilgari 404 sahifasi
// o'z nusxasini e'lon qilardi va Next uning fayllarini ham HAR sahifaga preload qilardi
// (10 ta shrift, 222 KB, shundan 4 tasi hech qachon chizilmasdi).
//
// subsets faqat preload uchun: Google CSS dagi hamma qism (latin, latin-ext, kirill...) baribir
// unicode-range bilan ulanadi va brauzer sahifadagi harflarga kerak qismini o'zi oladi.
// O'zbekcha o' va g' ham lotin qismida, latin-ext shart emas. Shuning uchun oldindan faqat matn va
// sarlavha shriftlarining lotin qismi keladi; kirill qismi ruscha sahifada matn chizilganda yuklanadi.
// Manrope o'zgaruvchan shrift: og'irlik ro'yxati faylni kichraytirmasdi (400 dan 800 gacha bitta
// fayl), faqat CSS ga 24 ta ortiqcha @font-face qo'shardi. weight berilmasa butun o'q olinadi.
const body = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });
// Sarlavha shrifti faqat 700 da chiziladi (font-display hamma joyda font-bold bilan). Bitta
// og'irlik so'ralsa Google o'zgaruvchan fayl o'rniga statik 700 beradi: lotin qismi 50 KB dan 21 KB ga.
// Oldindan yuklanadi: har sahifaning bosh sarlavhasi shu shriftda. Busiz u CSS dan keyin topilar va
// birinchi kirishda sarlavha boshqa shriftda chiqib, keyin sakrardi. Lotin sahifalarda fayl baribir
// yuklanadi, ya'ni preload bayt qo'shmaydi, faqat ertaroq olib keladi.
const display = Unbounded({ weight: '700', subsets: ['latin'], variable: '--font-unbounded', display: 'swap' });
// 600 kerak (font-mono font-semibold va font-bold yorliqlari); ikkala og'irlik bitta faylda.
const mono = JetBrains_Mono({ weight: ['400', '600'], variable: '--font-jetbrains', display: 'swap', preload: false });

/** html className: globals.css dagi @theme shu uchta o'zgaruvchini o'qiydi. */
export const fontVars = `${display.variable} ${body.variable} ${mono.variable}`;
