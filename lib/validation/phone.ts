const PHONE_PATTERN = /^\d{10}$/

// Empty is valid since phone is an optional field — only validate when the user entered something.
export function isValidPhone(phone: string | null | undefined): boolean {
  const trimmed = (phone || '').trim()
  if (!trimmed) return true
  return PHONE_PATTERN.test(trimmed)
}

export const PHONE_FORMAT_ERROR = 'Phone number must be exactly 10 digits'
