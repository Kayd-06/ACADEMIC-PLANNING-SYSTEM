# Faculty Tab Avatar & Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a profile-picture avatar column and row-selection delete (single/multiple/all) to the Faculty tab in Academic Planning.

**Architecture:** Everything lives in the existing `components/dashboard/management/FacultyTab.tsx` client component. It reuses the shared `Avatar` component for photos and the existing `DELETE /api/teacher-portal/faculty?id=<id>` endpoint (looped client-side via `Promise.allSettled`) for deletion — no new API routes, no new files.

**Tech Stack:** Next.js App Router, React 19 client component, Tailwind CSS, `lucide-react` icons, existing `Avatar` component (`components/dashboard/Avatar.tsx`).

## Global Constraints

- No new API endpoint — reuse `DELETE /api/teacher-portal/faculty?id=<id>` (`app/api/teacher-portal/faculty/route.ts:139-154`), called once per selected id.
- No photo upload UI — `profileImgUrl` is display-only in this tab.
- No typed delete confirmation — a simple Cancel/Delete confirm modal is sufficient.
- "Delete all" is not a separate code path — selecting every row via the header checkbox and clicking delete uses the exact same flow as any other multi-select delete.
- Confirm modal copy: lists names when `selectedIds.size <= 5`, otherwise shows "Delete N faculty members?"; body text is "This also removes their batch assignments and cannot be undone."
- No new test file — matches the existing no-test convention for `FacultyTab.tsx` (per spec's Testing section). Verification is `tsc --noEmit` plus a manual QA checklist.

---

### Task 1: Avatar column + row selection

**Files:**
- Modify: `components/dashboard/management/FacultyTab.tsx` (full file, 100 lines currently)

**Interfaces:**
- Consumes: `Avatar` component from `components/dashboard/Avatar.tsx`, signature `Avatar({ src?: string | null, name: string, size: string, ... })`.
- Produces: `selectedIds: Set<string>` state, `toggleRow(id: string): void`, `toggleAll(): void` — Task 2 reads and extends this state.

- [ ] **Step 1: Replace `FacultyTab.tsx` with the avatar + selection version**

Replace the entire contents of `components/dashboard/management/FacultyTab.tsx` with:

```tsx
'use client'
import { useState, useEffect } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import FacultyCsvUploadModal from './FacultyCsvUploadModal'
import Avatar from '../Avatar'

export default function FacultyTab() {
  const [facultyList, setFacultyList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showImport, setShowImport] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => { fetchFaculty() }, [])

  async function fetchFaculty() {
    setLoading(true)
    try {
      const res = await fetch('/api/teacher-portal/faculty')
      const data = await res.json()
      if (Array.isArray(data)) setFacultyList(data)
    } catch (err) {
      console.error('Failed to fetch faculty', err)
    } finally {
      setLoading(false)
    }
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelectedIds((prev) =>
      prev.size === facultyList.length ? new Set() : new Set(facultyList.map((f) => f.id))
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-[13px] text-slate-500">
          {facultyList.length} faculty member{facultyList.length === 1 ? '' : 's'} across all batches
        </p>
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#0b1320] hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all shadow-sm active:scale-95"
        >
          <Upload className="w-4 h-4" /> Import CSV
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
        </div>
      ) : facultyList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <p className="text-sm">No faculty found. Import a CSV to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={facultyList.length > 0 && selectedIds.size === facultyList.length}
                    onChange={toggleAll}
                    aria-label="Select all faculty"
                  />
                </th>
                <th className="px-6 py-3 text-left font-bold text-slate-400 uppercase tracking-wider text-[10px] w-14">Avatar</th>
                {['Name', 'Employee ID', 'Subject / Specialization', 'Batches', 'Status'].map((h) => (
                  <th key={h} className="px-6 py-3 text-left font-bold text-slate-400 uppercase tracking-wider text-[10px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {facultyList.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50/70">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(f.id)}
                      onChange={() => toggleRow(f.id)}
                      aria-label={`Select ${f.name}`}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <Avatar src={f.profileImgUrl} name={f.name} size="w-8 h-8" />
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-900">{f.name}</td>
                  <td className="px-6 py-4 text-slate-500">{f.employeeId || '—'}</td>
                  <td className="px-6 py-4 text-slate-600">{f.subject}{f.specialization ? ` — ${f.specialization}` : ''}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {(f.batchAssignments || []).length === 0 ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        f.batchAssignments.map((b: any) => (
                          <span key={b.id} className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 rounded-md">
                            {b.batchName}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border uppercase tracking-wider ${
                      f.status === 'ACTIVE' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' :
                      f.status === 'ON_LEAVE' ? 'border-amber-200 text-amber-700 bg-amber-50' :
                      'border-slate-200 text-slate-700 bg-slate-50'
                    }`}>{f.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showImport && (
        <FacultyCsvUploadModal
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); fetchFaculty() }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors referencing `FacultyTab.tsx` or `Avatar.tsx`.

- [ ] **Step 3: Manual verification**

Run `npm run dev`, log in as a management user, open Academic Planning → Faculty tab:
- Confirm an Avatar column renders left of Name: a photo for faculty with `profileImgUrl` set, an initials circle otherwise.
- Confirm a checkbox appears in the header and on every row.
- Click a row checkbox — only that row toggles.
- Click the header checkbox — all rows toggle on; click again — all toggle off.
- Manually deselect one row after "select all" — header checkbox becomes unchecked (since the plan uses a simple equality check, not a three-state indeterminate control — this is expected, not a bug).

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/management/FacultyTab.tsx
git commit -m "feat: add avatar column and row selection to Faculty tab"
```

---

### Task 2: Delete action bar, confirm modal, and delete execution

**Files:**
- Modify: `components/dashboard/management/FacultyTab.tsx` (full file, output of Task 1)

**Interfaces:**
- Consumes: `selectedIds: Set<string>`, `setSelectedIds`, `facultyList`, `fetchFaculty()` from Task 1.
- Produces: none consumed by later tasks — this is the final task in the plan.

- [ ] **Step 1: Replace `FacultyTab.tsx` with the delete-enabled version**

Replace the entire contents of `components/dashboard/management/FacultyTab.tsx` with:

```tsx
'use client'
import { useState, useEffect } from 'react'
import { Upload, Loader2, Trash2 } from 'lucide-react'
import FacultyCsvUploadModal from './FacultyCsvUploadModal'
import Avatar from '../Avatar'

export default function FacultyTab() {
  const [facultyList, setFacultyList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showImport, setShowImport] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showConfirm, setShowConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => { fetchFaculty() }, [])

  async function fetchFaculty() {
    setLoading(true)
    try {
      const res = await fetch('/api/teacher-portal/faculty')
      const data = await res.json()
      if (Array.isArray(data)) setFacultyList(data)
    } catch (err) {
      console.error('Failed to fetch faculty', err)
    } finally {
      setLoading(false)
    }
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelectedIds((prev) =>
      prev.size === facultyList.length ? new Set() : new Set(facultyList.map((f) => f.id))
    )
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    const ids = Array.from(selectedIds)
    const results = await Promise.allSettled(
      ids.map((id) => fetch(`/api/teacher-portal/faculty?id=${id}`, { method: 'DELETE' }))
    )
    const failed = results.filter((r) => r.status === 'rejected' || !r.value.ok).length
    setDeleting(false)
    setShowConfirm(false)
    setSelectedIds(new Set())
    await fetchFaculty()
    if (failed > 0) {
      setDeleteError(`Deleted ${ids.length - failed} of ${ids.length} faculty members. ${failed} failed — please retry.`)
    }
  }

  const selectedNames = facultyList.filter((f) => selectedIds.has(f.id)).map((f) => f.name)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-[13px] text-slate-500">
          {facultyList.length} faculty member{facultyList.length === 1 ? '' : 's'} across all batches
        </p>
        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && (
            <button
              onClick={() => setShowConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-all shadow-sm active:scale-95"
            >
              <Trash2 className="w-4 h-4" /> Delete ({selectedIds.size})
            </button>
          )}
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#0b1320] hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all shadow-sm active:scale-95"
          >
            <Upload className="w-4 h-4" /> Import CSV
          </button>
        </div>
      </div>

      {deleteError && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {deleteError}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
        </div>
      ) : facultyList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <p className="text-sm">No faculty found. Import a CSV to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={facultyList.length > 0 && selectedIds.size === facultyList.length}
                    onChange={toggleAll}
                    aria-label="Select all faculty"
                  />
                </th>
                <th className="px-6 py-3 text-left font-bold text-slate-400 uppercase tracking-wider text-[10px] w-14">Avatar</th>
                {['Name', 'Employee ID', 'Subject / Specialization', 'Batches', 'Status'].map((h) => (
                  <th key={h} className="px-6 py-3 text-left font-bold text-slate-400 uppercase tracking-wider text-[10px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {facultyList.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50/70">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(f.id)}
                      onChange={() => toggleRow(f.id)}
                      aria-label={`Select ${f.name}`}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <Avatar src={f.profileImgUrl} name={f.name} size="w-8 h-8" />
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-900">{f.name}</td>
                  <td className="px-6 py-4 text-slate-500">{f.employeeId || '—'}</td>
                  <td className="px-6 py-4 text-slate-600">{f.subject}{f.specialization ? ` — ${f.specialization}` : ''}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {(f.batchAssignments || []).length === 0 ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        f.batchAssignments.map((b: any) => (
                          <span key={b.id} className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 rounded-md">
                            {b.batchName}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border uppercase tracking-wider ${
                      f.status === 'ACTIVE' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' :
                      f.status === 'ON_LEAVE' ? 'border-amber-200 text-amber-700 bg-amber-50' :
                      'border-slate-200 text-slate-700 bg-slate-50'
                    }`}>{f.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showImport && (
        <FacultyCsvUploadModal
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); fetchFaculty() }}
        />
      )}

      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              {selectedNames.length <= 5
                ? `Delete ${selectedNames.join(', ')}?`
                : `Delete ${selectedNames.length} faculty members?`}
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              This also removes their batch assignments and cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors referencing `FacultyTab.tsx`.

- [ ] **Step 3: Manual verification**

With `npm run dev` still running, log in as a management user, open Academic Planning → Faculty tab:
- Select 1 row: red "Delete (1)" button appears next to "Import CSV". Click it — confirm modal shows "Delete <name>?" with the batch-assignment warning.
- Click Cancel — modal closes, row stays in the list, still selected.
- Click Delete — modal closes, row disappears from the list, selection clears, no error banner.
- Select 2 rows, delete both via the same flow — modal lists both names (`Delete <name1>, <name2>?`), both rows disappear after confirming.
- Select all rows via the header checkbox, click "Delete (N)" — modal shows "Delete N faculty members?" (name list only shown when ≤5), confirm — all rows disappear, "No faculty found. Import a CSV to get started." shows afterward.
- Re-import a previously deleted faculty member's CSV row afterward to confirm no leftover unique-constraint conflicts (deletion was real, not soft).

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/management/FacultyTab.tsx
git commit -m "feat: add delete action to Faculty tab"
```

---

## Self-Review Notes

- **Spec coverage:** Avatar column (Task 1) ✅. Row + header select-all checkboxes (Task 1) ✅. Red "Delete (N)" button next to Import CSV (Task 2) ✅. Confirm modal with name list ≤5 / count >5 and cancel/delete buttons (Task 2) ✅. `Promise.allSettled` over the existing single-delete endpoint, clear selection, refetch, partial-failure banner (Task 2) ✅. "All" as the same code path as multi-select (Task 2, no separate branch) ✅.
- **Placeholder scan:** none found — both tasks ship complete, runnable file contents.
- **Type consistency:** `selectedIds: Set<string>` and `toggleRow`/`toggleAll` signatures introduced in Task 1 are used unchanged in Task 2; `fetchFaculty()` (no args, returns `Promise<void>`) is reused unchanged from Task 1 into Task 2's `handleDelete`.
