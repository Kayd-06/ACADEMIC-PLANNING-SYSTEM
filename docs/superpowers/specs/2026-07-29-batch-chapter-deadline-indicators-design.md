# Batch/Chapter Deadline Indicators Design

## Problem

Batch cards (`components/dashboard/management/BatchesTab.tsx`) show a start→end date range as plain text, and syllabus chapter cards (`components/dashboard/SyllabusKanbanBoard.tsx`) show a "Target: ..." date range as plain text. Neither surfaces how much time is actually left before that deadline — a coordinator has to read the date and do the math themselves, for every card, every time.

## Goal

Add a colored urgency indicator to both card types that reflects days remaining until the relevant target date, recomputed fresh from the current date on every render (no timers — day-granularity, so a normal render/refetch cadence is sufficient).

## Shared logic — `lib/date.ts`

Two new exported functions, alongside the existing `formatDate`/`formatDateTime`/`formatDateWithWeekday` helpers.

### `parseTargetDate(val: string | number | null | undefined): Date | null`

Parses a target date from:
- an ISO `YYYY-MM-DD` string (batch `endDate`)
- an Excel date serial number (same `(num - 25569) * 86400 * 1000` conversion `SyllabusKanbanBoard.tsx`'s `formatDisplayDate` already uses)
- a `"<start> - <end>"` range string (chapter `dates` field) — uses the **end** token, splitting on `' - '` exactly like `formatDisplayDate` does

Returns `null` when nothing parseable is found (empty string, garbage text, etc.) — this is the "no usable target date" case.

### `getUrgency(targetDate: Date | null, isDone: boolean = false): Urgency`

```ts
export type UrgencyLevel = 'none' | 'safe' | 'warning' | 'critical' | 'overdue' | 'done'

export interface Urgency {
  level: UrgencyLevel
  daysRemaining: number | null
  label: string
}
```

Logic, in order:
1. `isDone === true` → `{ level: 'done', daysRemaining: null, label: 'Completed' }` (checked before any date logic)
2. `targetDate === null` → `{ level: 'none', daysRemaining: null, label: '' }`
3. Otherwise, compute `daysRemaining` as whole days between today (local, time zeroed) and `targetDate` (time zeroed):
   - `daysRemaining < 0` → `level: 'overdue'`, label `` `Overdue by ${Math.abs(daysRemaining)}d` ``
   - `daysRemaining === 0` → `level: 'critical'`, label `'Due today'`
   - `0 < daysRemaining < 3` → `level: 'critical'`, label `` `${daysRemaining}d left` ``
   - `3 <= daysRemaining <= 14` → `level: 'warning'`, label `` `${daysRemaining}d left` ``
   - `daysRemaining > 14` → `level: 'safe'`, label `` `${daysRemaining}d left` ``

Color-class maps (Tailwind) are **not** part of this shared module — they stay local to each component as small consts, since each card type styles the indicator slightly differently (bar vs. badge) and the maps are only 5 entries each.

## Batch cards — `BatchesTab.tsx`

The existing top strip (`h-1.5 w-full ${pct >= 100 ? 'bg-rose-500' : ...}`, ~line 208) stays exactly as-is — it encodes enrollment capacity, a different metric, and shouldn't be overloaded.

Add a small badge chip next to the existing date row (the `CalendarDays` + `{b.startDate} → {b.endDate}` line, ~line 257-260), computed as `getUrgency(parseTargetDate(b.endDate), false)`. Rendered only when `urgency.level !== 'none'` (per the "no badge when no date" decision). Batches have no completion concept, so `isDone` is always `false` here.

Local color map:
```ts
const URGENCY_BADGE_CLASS: Record<UrgencyLevel, string> = {
  safe:     'bg-emerald-50 text-emerald-700 border-emerald-100',
  warning:  'bg-amber-50 text-amber-700 border-amber-100',
  critical: 'bg-rose-50 text-rose-700 border-rose-100',
  overdue:  'bg-red-100 text-red-800 border-red-200',
  done:     'bg-slate-100 text-slate-500 border-slate-200',
  none:     '', // unused — badge not rendered
}
```

## Chapter cards — `SyllabusKanbanBoard.tsx`

These cards currently have no top strip. Restructure the card (~line 1071-1109) from a single padded `<div>` into an outer `overflow-hidden rounded-xl border ...` wrapper containing:
1. A 1px colored top bar: `<div className={`h-1 w-full ${URGENCY_BAR_CLASS[urgency.level]}`} />`
2. The existing padded content, moved into an inner `<div className="p-4 space-y-3 ...">` (same classes it has today minus the ones now on the outer wrapper)

This mirrors the outer-wrapper-plus-strip pattern `BatchesTab.tsx` cards already use.

`urgency = getUrgency(parseTargetDate(chap.dates), chap.status === 'COMPLETED')`.

Badge placement: appended next to the existing "Target: ..." line (~line 1086):
```tsx
<p className="text-[10px] text-slate-500 mt-1 font-medium flex items-center gap-1.5 flex-wrap">
  Target: {formatDisplayDate(chap.dates) || 'Not set'}
  {urgency.label && (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${URGENCY_BADGE_CLASS[urgency.level]}`}>
      {urgency.label}
    </span>
  )}
</p>
```

Local color maps (bar uses solid fills, badge reuses the same 5-entry shape as the batch card's):
```ts
const URGENCY_BAR_CLASS: Record<UrgencyLevel, string> = {
  safe:     'bg-emerald-500',
  warning:  'bg-amber-400',
  critical: 'bg-rose-500',
  overdue:  'bg-red-800',
  done:     'bg-emerald-600',
  none:     'bg-slate-200',
}
```

For `done`, the bar is a calm emerald (distinguishable from `safe`'s brighter emerald mainly by the "Completed" badge text, not by hue alone — acceptable since a completed chapter is never simultaneously time-critical). For `none` (no parseable date), the bar renders in neutral gray with no badge, per the earlier decision — this is the one case where the bar still renders (unlike the batch card's badge, which is skipped entirely) so the card's visual structure stays consistent across all chapters in a column.

## Out of scope

- No live-updating timer/interval — indicators recompute on each render/refetch, which is sufficient at day granularity.
- No change to the batch card's existing capacity top-bar.
- No historical/audit tracking of when a chapter crossed into "overdue".
- No configurable thresholds (14/3/0 days are fixed, not a per-school setting).
