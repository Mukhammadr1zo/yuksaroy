/**
 * Telefon ochilishi audit amallari.
 *
 * Ikki iste'molchi bor: kunlik kvota (contacts.controller) va obuna hisoboti
 * (subscription.service.lapsed), shuning uchun ro'yxat bitta joyda turadi.
 * 'contact.deal' bitim tuzilgandan keyingi raqam: u qidiruvda ochilgan emas va
 * bepul oynani yemaydi, kunlik chegaraga esa sanaladi.
 */
export const REVEAL_ACTIONS = ['contact.reveal', 'contact.deal'] as const;
