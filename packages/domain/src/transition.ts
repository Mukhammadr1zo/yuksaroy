// Holat-mashinasi xatosi. Alohida fayl: index va listing ikkalasi ham shu bitta nusxaga tayanadi (instanceof ishlashi uchun).
export class TransitionError extends Error {
  constructor(readonly from: string, readonly to: string, readonly actor: string, readonly reason: 'NOT_ALLOWED' | 'WRONG_ACTOR') {
    super(`TRANSITION_${reason}`);
  }
}
