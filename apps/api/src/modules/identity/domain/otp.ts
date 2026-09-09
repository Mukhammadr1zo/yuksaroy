import { createHash, randomBytes, randomInt } from 'node:crypto';
import { OTP } from '@yuksaroy/domain';

export function generateOtpCode(): string {
  return randomInt(0, 10 ** OTP.length).toString().padStart(OTP.length, '0');
}

export function hashSecret(value: string, pepper: string): string {
  return createHash('sha256').update(`${pepper}:${value}`).digest('hex');
}

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url');
}

export function otpExpiry(now = new Date()): Date {
  return new Date(now.getTime() + OTP.ttlSeconds * 1000);
}
