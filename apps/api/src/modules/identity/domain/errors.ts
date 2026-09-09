// identity xatolari: controller HTTP kodga aylantiradi.
export class OtpInvalidError extends Error {
  constructor(public readonly reason: 'EXPIRED' | 'WRONG' | 'LOCKED' | 'NOT_FOUND') { super(`OTP_${reason}`); }
}
/** Telefon boshqa foydalanuvchiga tegishli: bog'lab bo'lmaydi. */
export class PhoneTakenError extends Error {
  constructor() { super('PHONE_TAKEN'); }
}
export class BadCredentialsError extends Error {
  constructor() { super('BAD_CREDENTIALS'); }
}
export class NoPasswordError extends Error {
  constructor() { super('NO_PASSWORD'); }
}
export class LoginLockedError extends Error {
  constructor(public readonly retryAfter: number) { super('LOGIN_LOCKED'); }
}
