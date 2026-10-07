import type { PrismaService } from '../../common/prisma.service';

/**
 * Yozishmaga yangi xabar tushdi: oxirgi xabar vaqti va holat. Bitta joyda, chunki xabar ikki yo'l
 * bilan keladi: suhbat oynasi (ChatService.send) va e'lon sahifasidagi forma (ListingsUseCase.inquire,
 * Telegram ilovasi ham hamma xabarni shu yo'ldan yuboradi). Ikkinchi yo'l ilgari holatga tegmasdi,
 * ya'ni mijozning keyingi savoli e'lon suhbatini qayta ochmasdi.
 *
 * OPEN = qabul qiluvchi tomon javob qarzdor. Egasi qarori (2026-10-07): javob olgan suhbatga mijoz
 * yana yozsa suhbat OPEN ga qaytadi (platformaga ham, obyekt egasiga ham): kabinetda yana "Javob
 * kutilmoqda", platformaniki admin navbatida ham.
 *
 * Yozuv shartli: ikki tomon bir zumda yozsa oxirgi kelgan so'rov emas, eng yangi xabar holatni
 * belgilaydi. Aks holda javob berilgan suhbat navbatda qolar yoki mijozning savoli undan tushib qolardi.
 *
 * Xabarsiz yo'l bitta: qabul qiluvchi "Javob shart emas" bilan ANSWERED qiladi (ChatService.noReply,
 * 2026-10-07). Mijozning keyingi xabari baribir shu yerda OPEN qiladi.
 */
export function markInquiryMessage(prisma: PrismaService, inquiryId: string, createdAt: Date, fromReceiver: boolean) {
  return prisma.inquiry.updateMany({
    where: { id: inquiryId, OR: [{ lastMessageAt: null }, { lastMessageAt: { lte: createdAt } }] },
    data: { lastMessageAt: createdAt, status: fromReceiver ? 'ANSWERED' : 'OPEN' },
  });
}

/**
 * "Javob shart emas": qabul qiluvchi OPEN suhbatni xabarsiz ANSWERED qiladi. Holatni yozadigan
 * ikkinchi va oxirgi yo'l shu, ikkalasi shu faylda: qoidani o'zgartirgan odam ikkalasini ko'rsin.
 * Shart: suhbat hamon OPEN va oyna ochilgandan beri yangi xabar kelmagan (lastMessageAt o'sha
 * qiymat). Aks holda count 0 bo'ladi va chaqiruvchi 409 beradi: mijozning yangi savoli jimgina
 * yopilib ketmasin.
 */
export function markInquiryNoReply(prisma: PrismaService, inquiryId: string, lastMessageAt: Date | null) {
  return prisma.inquiry.updateMany({ where: { id: inquiryId, status: 'OPEN', lastMessageAt }, data: { status: 'ANSWERED' } });
}

/**
 * "Javob shart emas" ning audit amali. Xabar yozilmaydi, shuning uchun platforma navbatining yoshi
 * (common/admin-queues.ts waitingSince) shu qatorga qaraydi: undan oldingi mijoz xabarlari endi
 * kutayotgan hisoblanmaydi. U yerda SQL matnida turadi, no-reply.spec ikkalasini solishtiradi.
 * ponytail: audit qatori holatdan keyin alohida yoziladi. Tugma bilan millisekundlar ichida kelgan
 * mijoz xabari yoshga kirmay qolishi mumkin (suhbat navbat sonida baribir turadi); kerak bo'lsa
 * ikkalasi bitta tranzaksiyaga olinadi.
 */
export const NO_REPLY_ACTION = 'inquiry.noReply';
