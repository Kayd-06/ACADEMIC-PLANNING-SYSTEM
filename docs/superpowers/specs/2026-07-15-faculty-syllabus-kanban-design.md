# Faculty Syllabus Kanban Board — Design

## Overview

Admin's "Syllabus Tracker" tab (`components/dashboard/management/AcademicPlanningView.tsx`) shows a 3-column Kanban board (Not Started / In Progress / Completed) with an "Add Chapter" button and a click-to-edit/delete modal per chapter card. Faculty's "Academic Planning" page (`components/dashboard/teacher/FacultyAcademicPlanningView.tsx`) instead shows a flat list with a segmented status control per row, and has no way to add or delete a chapter.

The backend (`app/api/teacher-portal/academic-planning/chapters/route.ts`, just fixed for school-scoping) applies no role restriction — any authenticated user in the correct school can already GET/PATCH/POST/DELETE. The gap is UI-only: faculty's page never exposes add/edit/delete.

## Goal

Give faculty the identical Kanban board, "Add Chapter" button, and click-to-edit/delete modal that admin has, by extracting the existing admin UI into a shared component both pages render.

## Non-Goals

- No backend changes — the route's authorization already treats both roles identically.
- No change to admin's page behavior or appearance.
- No change to the hardcoded subject list content (`Physics, Chemistry, Mathematics, Biology, English`) or the chapter-fetching/status logic — only relocating existing code, not rewriting its behavior.

## Design

### New component: `components/dashboard/SyllabusKanbanBoard.tsx`

Extracted verbatim (no behavior change) from `AcademicPlanningView.tsx`'s current "Syllabus Tracker" tab body: the batch/subject selector row + "Add Chapter" button, the 3-column Kanban grid, and the Add/Edit Chapter modal (title/hours/dates/status/notes fields, Delete Chapter button in edit mode, Cancel/Save buttons).

**Props:**
```ts
interface SyllabusKanbanBoardProps {
  batches: string[] // batch names for the "Select Batch" dropdown
}
```

Everything else — the hardcoded subject list, `selectedBatch`/`selectedSubject`/`chapters`/`chapterModal`/`chapterForm` state, `fetchChapters`, `handleUpdateChapterStatus`, `saveChapter`, `handleDeleteChapter`, and the toast — moves into this component unchanged. Both roles get full add/edit/delete/status-change, since the backend doesn't distinguish them.

### `AcademicPlanningView.tsx` (admin)

The "Syllabus Tracker" tab's JSX body (currently ~350 lines: the controls row, Kanban grid, and modal) is replaced with:
```tsx
<SyllabusKanbanBoard batches={batchesList.map(b => b.name)} />
```
The now-unused local state (`selectedBatch`, `selectedSubject`, `chapters`, `chaptersLoading`, `chapterModal`, `chapterForm`) and handlers (`fetchChapters`, `handleUpdateChapterStatus`, `saveChapter`, `handleDeleteChapter`) are removed from this file along with the JSX that used them — they now live only in `SyllabusKanbanBoard.tsx`. `batchesList` (fetched via `/api/batches`) and the `Programs`/`Batches`/`Schools` tabs are untouched.

### `FacultyAcademicPlanningView.tsx` (faculty)

The current list-based rendering (chapter list, segmented status control, notes field, loading/empty states) is replaced with:
```tsx
<SyllabusKanbanBoard batches={batches} />
```
The page keeps its existing `batches` state (fetched via `/api/daily-report`, `PUT` method) and its header. The now-unused local state (`chapters`, `totalChapters`, `savingId`, `activeClass`, `activeSubject`) and handlers (`fetchChapters`, `handleStatusChange`, `handleNotesChange`, `handleSaveNotes`, `getStatusTheme`) are removed — the shared component owns all of that internally now.

One visible behavior change on the faculty side: the "Overall Syllabus Completion" summary card (0%, Total Chapters: 24, Completed/Remaining) that faculty currently has is dropped, since admin's Kanban view never had an equivalent card and the new component doesn't produce one — faculty's page becomes a Kanban board exactly matching admin's, with no separate summary card above it.

## Testing

No automated test convention exists for `.tsx` components in this codebase (verified throughout the Tests & Question Bank work) — verification is via `npx tsc --noEmit` and a manual dev-server check on both the admin and faculty pages: add a chapter as faculty, confirm it appears in admin's board (and vice versa), confirm edit/delete/status-change work identically on both sides, confirm admin's other three tabs (Programs/Batches/Schools) are unaffected.
