const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Empty is valid since email is an optional field — only validate when the user entered something.
export function isValidEmail(email: string | null | undefined): boolean {
  const trimmed = (email || '').trim()
  if (!trimmed) return true
  return EMAIL_PATTERN.test(trimmed)
}

export const EMAIL_FORMAT_ERROR = 'Please enter a valid email address'
