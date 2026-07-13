import crypto from 'crypto'

export function generateOtp(): string {
  // crypto.randomInt avoids Math.random()'s modulo bias for a security code
  return crypto.randomInt(100000, 1000000).toString()
}

export function isExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt
}

export function getExpiry(minutes = 10): Date {
  return new Date(Date.now() + minutes * 60 * 1000)
}
