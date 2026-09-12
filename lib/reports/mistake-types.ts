export const MISTAKE_TYPES = [
  'Calculation Error',
  'Conceptual Error',
  'Formula Error',
  'Silly Mistake',
  'Time Management',
  'Other',
] as const

export type MistakeType = typeof MISTAKE_TYPES[number]
