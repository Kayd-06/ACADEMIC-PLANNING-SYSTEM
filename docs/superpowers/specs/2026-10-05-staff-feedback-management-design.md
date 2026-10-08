# Staff Feedback Management (Management ↔ Teacher) — Design

Date: 2026-10-05

## Goal

Make the Feedback section work end to end for admin (role `management`) and faculty (role `teacher`):
two-way feedback between them, tracked to resolution, with KPIs the user can trust.

## Scope

In scope: `Management -> Teacher` and `Teacher -> Management` feedback only.

Out of scope (deliberately skipped for now):
- Student and parent feedback intake. The `Student -> Teacher` and `Parent -> School` types stay in the
  data model and the Excel bulk-upload path keeps working, but they are hidden from the UI and no new
  intake is built.
- Public/QR feedback forms.
- Full conversation threads. A single reply per feedback item is enough.

## Decisions

- **No anonymous feedback.** The sender's real name is always stored and always shown to admins. The
  "Send anonymously" option is removed. The existing `is_anonymous` column stays (no destructive
  migration) but staff flows never read or write it.
- **Single table.** Everything lives in the Postgres `feedback` table. The Mongo `Feedback` model and
  `/api/teacher/feedback` are retired from the feedback screens.
- **One reply field** on each row, written by the receiving side.
- **Teachers are targeted by ID**, not by name matching against `batch`/`subject`.

## Current problems this fixes

Admin ([FeedbackManagementView.tsx](../../../components/dashboard/management/FeedbackManagementView.tsx),
[api/feedback/route.ts](../../../app/api/feedback/route.ts)):
- "Total Feedback This Month" counts every row ever.
- "Reviewed" rows appear in both Pending and Actioned lists; the Actioned counter disagrees with its list.
- Sentiment Keywords is a hardcoded list, not computed.
- Admin cannot reply to a teacher, only change status.
- Bulk upload `POST` is open to teachers.

Teacher ([TeacherFeedbackView.tsx](../../../components/dashboard/teacher/TeacherFeedbackView.tsx)):
- "Recent Feedback" reads the Mongo `Feedback` collection (cross-school, unscoped, fake 4.8 average when
  empty) and never sees Postgres data.
- Acknowledge writes `Resolved`, a status the admin workflow doesn't use.
- Filter button is dead.
- The `sent` list returns every teacher's upward feedback in the school (privacy leak).
- Teacher sidebar has no Feedback entry.

## Data model (slice 2)

Migration `0051_feedback_targeting_replies.sql`, added to `feedback`:

| Column | Type | Meaning |
|---|---|---|
| `target_teacher_id` | uuid, FK `faculty.id`, on delete set null, nullable | Teacher the feedback is addressed to. Null = all faculty. Only used for `Management -> Teacher`. |
| `sender_user_id` | uuid, FK `users.id`, on delete set null, nullable | Who sent it. |
| `response` | text, nullable | Reply from the receiving side. |
| `responded_by` | uuid, FK `users.id`, on delete set null, nullable | Who replied. |
| `responded_at` | timestamptz, nullable | When. |
| `acknowledged_at` | timestamptz, nullable | When a teacher marked a received message as seen. |

Indexes: `(school_id, type, status)` and `(target_teacher_id)`.

Backfill: for existing `Management -> Teacher` rows, resolve `target_teacher_id` by matching `batch`
(teacher name) or `subject` (teacher email) against `faculty` in the same school; unmatched rows stay
null (treated as all-faculty). Existing `Teacher -> Management` rows get `sender_user_id` by matching
`sender_name` to a user in the same school where unambiguous; otherwise null.

Faculty ↔ user mapping uses `faculty.user_id` (already exists).

## API (`/api/feedback`)

Status values stay `Submitted | Reviewed | Actioned | Dismissed`. `Resolved` is no longer written.

**GET**
- `management`: filters `direction` (`received` = Teacher→Management, `sent` = Management→Teacher),
  `status`, `teacherId`, `q`, `month`. Returns list plus KPIs computed over the same school-scoped set:
  - this-month count (month filter on `date`),
  - average rating over rows with a rating,
  - open count (`Submitted` + `Reviewed`),
  - resolved count (`Actioned` + `Dismissed`),
  - rating distribution as real counts and percentages.
  Pending vs Actioned lists use a single definition: Pending = `Submitted` + `Reviewed`;
  Actioned = `Actioned` + `Dismissed`. No overlap.
- `teacher`: returns only
  - `received`: `Management -> Teacher` where `target_teacher_id` is the caller's faculty id or null,
  - `sent`: `Teacher -> Management` where `sender_user_id` is the caller.
  Never other teachers' rows.

**POST**
- `management`: send to one teacher (`targetTeacherId`) or all (null). Validates the teacher belongs to
  the caller's school. Notifies the target teacher (or all teachers).
- `teacher`: send up to management; type forced to `Teacher -> Management`; `sender_user_id` from the
  session. Notifies management.
- `isAnonymous` in any request body is ignored; `sender_name` is always the session user's name.
- `action: 'bulk'` is `management` only (403 for teachers).

**PUT**
- `management`: update `status`; optionally set `response` (reply to a teacher's feedback). A reply sets
  `responded_by/at` and notifies the sender.
- `teacher`: may set `acknowledged_at` and `response` only on a `Management -> Teacher` row addressed to
  them (or all faculty). Notifies the management sender.

**DELETE**: management only, unchanged.

All queries are school-scoped. Rows with a null `school_id` are not visible to a school-scoped caller.

`/api/teacher/feedback` and its use of the Mongo `Feedback` model are removed from the feedback screens;
the route is deleted once nothing calls it.

## Admin screen

- Tabs: **From Teachers** and **Sent to Teachers**. The Student/Parent tabs are hidden.
- From Teachers: inline reply box and status buttons per row; sender name always shown.
- Sent to Teachers: shows target teacher, rating, and the teacher's reply/acknowledgement.
- Send modal: faculty dropdown (id-based) plus an "All Faculty" option.
- KPI cards use the server KPIs above. The hardcoded Sentiment Keywords card is replaced by top terms
  computed from the visible feedback text (stop-words removed); if that proves noisy it is dropped
  rather than faked.
- Excel upload stays available as a secondary action.
- Anonymous avatar/label code is removed.

## Teacher screen

One page backed entirely by Postgres:
- **Inbox from management**: acknowledge and reply.
- **Send to management** form (rating, content; no anonymous option).
- **My sent**: own items with status and the admin's reply.
- The Mongo "Recent Feedback" block, the dead Filter button and the fake 4.8 average are removed.
- A Feedback item is added to `TEACHER_NAV` ([navigation.tsx](../../../lib/navigation.tsx)).
- The dashboard's "Feedback from Admin" card keeps working off `received`.

## Notifications

Uses the existing `notifyUsers` / `notifyRoleInSchool`:
- management sends → target teacher (or all teachers),
- teacher sends or replies → management of the school,
- management replies → the original sender.

## Delivery in two slices

**Slice 1 — fix and unify (no schema change)**
- `POST` bulk is management-only.
- Teacher `sent` filtered to the caller (by `sender_name` until slice 2 adds the ID).
- Teacher `received` keeps the existing name/email matching until slice 2 replaces it with the ID.
- Teacher page reads Postgres only; Mongo block, fake average, dead Filter and the Mongo-backed
  Acknowledge button are removed. The page is read + send in this slice; acknowledge and reply arrive
  in slice 2 (the teacher `PUT` does not exist until then).
- Fix KPI month filter, Pending/Actioned overlap and counters.
- Remove anonymous option from teacher form and API.
- Add Feedback to the teacher sidebar.

**Slice 2 — targeting and replies**
- Migration `0051` plus backfill.
- ID-based targeting, `sender_user_id`, reply and acknowledge flows.
- Faculty dropdown, tabs, reply UI, notifications.
- Computed keywords.
- Delete `/api/teacher/feedback`.

## Testing

- API route tests (Vitest, alongside the existing `route.test.ts` files) for role permissions: teacher
  cannot bulk upload, cannot read other teachers' sent items, cannot reply to a row not addressed to them;
  management cannot touch another school's rows.
- KPI tests: month filter, Pending/Actioned partition (every status lands in exactly one list), average
  ignores empty ratings.
- Backfill migration checked against a seeded copy: matched, unmatched and ambiguous teachers.
- Manual pass: send each direction, reply, acknowledge, status change, notification links.

## Risks

- Backfill by name/email can mis-match or miss; unmatched rows fall back to all-faculty rather than
  disappearing.
- Existing anonymous rows keep their stored "Anonymous" sender name; they are not relabelled.
- Retiring the Mongo route is only safe once the teacher page no longer calls it (slice 1 removes the call).
