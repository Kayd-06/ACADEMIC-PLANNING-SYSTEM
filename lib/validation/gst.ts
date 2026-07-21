const GST_PREFIX_PATTERN = /^\d{2}[A-Za-z]{5}/

// Empty is valid since gstNo is an optional field — only validate when the user entered something.
export function isValidGstPrefix(gstNo: string | null | undefined): boolean {
  const trimmed = (gstNo || '').trim()
  if (!trimmed) return true
  return GST_PREFIX_PATTERN.test(trimmed)
}

export const GST_FORMAT_ERROR = 'GST No. must start with 2 digits followed by 5 letters (e.g. 07AAAAA...)'
