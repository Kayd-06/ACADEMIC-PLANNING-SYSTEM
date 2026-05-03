import crypto from 'crypto'

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function isTokenExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt
}

export function getTokenExpiry(hours = 24): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000)
}
