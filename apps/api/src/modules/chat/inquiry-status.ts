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
 */
export function markInquiryMessage(prisma: PrismaService, inquiryId: string, createdAt: Date, fromReceiver: boolean) {
  return prisma.inquiry.updateMany({
    where: { id: inquiryId, OR: [{ lastMessageAt: null }, { lastMessageAt: { lte: createdAt } }] },
    data: { lastMessageAt: createdAt, status: fromReceiver ? 'ANSWERED' : 'OPEN' },
  });
}
