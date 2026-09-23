// Batches/curriculum in this app are built around the standard 9-12 chain
// (see docs/superpowers/specs/2026-07-27-automated-class-promotion-design.md),
// but a school's own "classes offered" (schools.classes, set via
// MultiSelectClasses in SchoolFormHelpers.tsx — a comma-separated list drawn
// from '6'..'12'/'12 pass') should still narrow which of those a batch can
// use. Legacy/unparseable values (e.g. the "Nursery – XII" column default)
// fall back to the full 9-12 range so existing schools keep working.
const KNOWN_NUMERIC_CLASSES = ['6', '7', '8', '9', '10', '11', '12']
const FALLBACK_CLASSES = ['9', '10', '11', '12']

export function parseSchoolClassLevels(classesRaw: string | null | undefined): string[] {
  const tokens = (classesRaw || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  const nums = tokens
    .map(t => {
      const n = parseInt(t, 10)
      return !isNaN(n) && n.toString() === t && KNOWN_NUMERIC_CLASSES.includes(t) ? n : null
    })
    .filter((n): n is number => n !== null)

  const unique = Array.from(new Set(nums)).sort((a, b) => a - b).map(String)
  return unique.length > 0 ? unique : FALLBACK_CLASSES
}

export function batchClassLevelOptions(classesRaw: string | null | undefined): string[] {
  return [...parseSchoolClassLevels(classesRaw), 'Repeater']
}
