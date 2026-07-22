# Faculty Tab — Profile Picture & Delete — Design

## Problem

The Faculty tab (`components/dashboard/management/FacultyTab.tsx`, added in `docs/superpowers/specs/2026-07-22-faculty-csv-import-design.md`) was deliberately scoped as list + import only, with edit/delete left to the existing Teacher Portal → Faculty Directory page. In practice the admin wants to manage faculty from this tab too: see each person's photo at a glance, and remove one, several, or all faculty records directly here — without switching pages.

## Goals

- Show each faculty member's profile photo (or initials fallback) in the Faculty tab list.
- Let the admin select one, several, or all faculty rows and delete them, with a confirmation step first.
- Reuse existing, already-scoped, already-cascading backend behavior rather than adding new API surface.

## Non-goals

- No photo upload/edit from this tab — `profileImgUrl` is set via the CSV import or the existing manual "Add/Edit Faculty" form on the Teacher Portal page. This tab only displays it.
- No new bulk-delete API endpoint — the existing `DELETE /api/teacher-portal/faculty?id=<id>` endpoint (`app/api/teacher-portal/faculty/route.ts:139-154`) is management-scoped, school-scoped, and already cascades to `teacher_batches` via FK (`teacherId` references `faculty.id` with `onDelete: cascade`). "Delete several" and "delete all" are the same client-side flow (select rows, call this endpoint once per selected id in parallel) — not a special server-side case.
- No undo/soft-delete — deletion is immediate and permanent, matching the existing single-delete endpoint's behavior today.
- No typed ("type DELETE to confirm") friction — a standard confirm modal is enough, per user preference in brainstorming.

## Design

### 1. Profile picture column

Add an "Avatar" column as the first column in the `FacultyTab` table, using the existing shared `Avatar` component (`components/dashboard/Avatar.tsx`):

```tsx
<Avatar src={f.profileImgUrl} name={f.name} size="w-8 h-8" />
```

`GET /api/teacher-portal/faculty` already returns `profileImgUrl` on each row (it's a plain column on `faculty`) — no API change needed. `Avatar` already handles the empty/broken-URL fallback to initials.

### 2. Row selection

`FacultyTab` gains `selectedIds: Set<string>` state. The table gains a checkbox column before Avatar:

- Header checkbox: checked when `selectedIds.size === facultyList.length && facultyList.length > 0`; clicking it selects all currently-loaded rows or clears selection.
- Per-row checkbox: toggles that row's id in `selectedIds`.

Selection is local UI state only, cleared after a successful delete or when the list is refetched.

### 3. Delete action + confirm modal

When `selectedIds.size > 0`, a red "Delete (N)" button renders next to the existing "Import CSV" button in the tab's header row. Clicking it opens a confirmation modal (new small inline component within `FacultyTab.tsx`, no separate file needed — mirrors the simplicity of existing inline confirm patterns in the codebase):

- If `selectedIds.size <= 5`: lists the selected faculty names.
- Else: shows "Delete 12 faculty members?"
- Body: "This also removes their batch assignments and cannot be undone."
- Buttons: "Cancel" / "Delete" (red, destructive style, matching the codebase's existing red-button convention for destructive actions).

### 4. Delete execution

On confirm:

```tsx
const results = await Promise.allSettled(
  Array.from(selectedIds).map((id) =>
    fetch(`/api/teacher-portal/faculty?id=${id}`, { method: 'DELETE' })
  )
)
const failed = results.filter((r) => r.status === 'rejected' || !r.value.ok).length
```

- Close the modal, clear `selectedIds`, refetch the list (`fetchFaculty()`) regardless of partial failure.
- If `failed > 0`, show an inline error banner: "Deleted {N - failed} of {N} faculty members. {failed} failed — please retry."
- If `failed === 0`, no banner needed (the list simply updates).

### 5. "Delete all"

Not a distinct feature: selecting every row via the header checkbox and clicking "Delete (N)" goes through the exact same modal and execution path above. No server-side "delete all" endpoint is added.

## Testing

No new API route is added, so no new route test file. `app/api/teacher-portal/faculty/route.test.ts` (if it exists) already covers the single-delete endpoint's auth/scoping/cascade behavior — this feature doesn't change that endpoint's behavior, only calls it more than once from the client.

Manual verification (component-level, matching the existing no-test convention for `FacultyTab.tsx`/`FacultyCsvUploadModal.tsx`):
- Avatar renders a photo when `profileImgUrl` is set, initials otherwise.
- Header checkbox selects/deselects all rows; per-row checkboxes update the header checkbox's checked/indeterminate state correctly.
- Deleting 1 row, several rows, and all rows each show the correct confirm-modal copy and correctly remove those rows after confirming.
- Cancel leaves the list unchanged and closes the modal.
