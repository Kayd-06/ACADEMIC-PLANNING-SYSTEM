// Batches/curriculum in this app are built around the standard 9-12 chain
// (see docs/superpowers/specs/2026-07-27-automated-class-promotion-design.md),
// but a school's own "classes offered" (schools.classes, set via
// MultiSelectClasses in SchoolFormHelpers.tsx — a comma-separated list drawn
// from CLASS_OPTIONS: '6'..'12'/'12 pass'/'Repeater') is the source of truth
// for which class levels a batch can use — nothing is force-added on top of
// what the school actually selected. Legacy/unparseable values (e.g. the
// "Nursery – XII" column default, from before this picker existed) fall back
// to the full 9-12 + Repeater range so those schools keep working.
const KNOWN_NUMERIC_CLASSES = ['6', '7', '8', '9', '10', '11', '12']
const FALLBACK_CLASSES = ['9', '10', '11', '12', 'Repeater']

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

  const uniqueNums = Array.from(new Set(nums)).sort((a, b) => a - b).map(String)
  const hasRepeater = tokens.some(t => t.toLowerCase() === 'repeater')
  const levels = hasRepeater ? [...uniqueNums, 'Repeater'] : uniqueNums

  return levels.length > 0 ? levels : FALLBACK_CLASSES
}

export function batchClassLevelOptions(classesRaw: string | null | undefined): string[] {
  return parseSchoolClassLevels(classesRaw)
}
