# Internal product audit — Academic Planning System

**Date:** 23 September 2026
**Ship window:** end of September 2026 (about seven days)
**Audience:** freelance delivery review. Kept in `docs/` with the system design.

This is a read of the application source: App Router pages, API routes, Drizzle schema, query layer, Mongo models, auth, and the specs under `docs/superpowers`. `node_modules` was not reviewed. The test suite and `npm run build` were not executed in this pass, so this document does not claim a green build or a green Jest run.

---

## 1. What you are actually shipping

A multi-school staff product. Two roles exist in the database: `teacher` and `management`. There is no student login and no parent login.

Stack, as it runs today:

- Next.js 16 App Router, React 19, Tailwind 4
- PostgreSQL on Neon, through Drizzle, using the Neon **HTTP** driver (`lib/db/index.ts`)
- NextAuth v5 credentials, JWT sessions, bcrypt passwords, email OTP for teachers and password reset
- A leftover MongoDB connection that a handful of routes still write to
- File storage on Vercel Blob, plus a local `public/uploads` reader
- One Vercel cron: class promotion at 03:00 daily (`vercel.json`)

The product name in the UI is **EduAdmin Pro**. The repo and README call it Academic Planning System. The landing footer still says © 2024.

A school can be created or joined with a join code. A management user can belong to more than one school and switch the active one. Teachers join exactly one school. Academic data is meant to be scoped by `schools.id`.

---

## 2. Verdict

The core staff workflow is real and largely on Postgres: schools, roster, faculty, timetable, attendance, syllabus kanban, tests and question bank, manual fees, counseling, meetings, calendar, daily reports, PTM notes, and class promotion for classes 9–12.

It is not ready to hand to a paying school this week, for three reasons that are already in the code:

1. Several APIs have no login check at all, and the auth middleware skips every `/api` route. Recruitment (candidates, salaries, interviews, appraisals, audit log) is world-readable and world-writable.
2. Empty schools get fake operational data written into Postgres the first time someone opens the dashboard or the fee screen: 2023 compliance policies, and JEE fee structures plus fake receipts against real students.
3. Tenant isolation is optional. If a session has no `schoolId`, list and get-by-id queries drop the school filter and return every school’s rows, including Aadhaar numbers.

The data model is a coaching-institute model (JEE / NEET / Foundation, classes 9–12), frozen into enums and defaults, while the school form still says “Nursery – XII” and “CBSE Affiliated”. A client that is not that institute will fight the product on day one.

---

## 3. What a school can use today

These surfaces are wired to Postgres, appear in the sidebar, and do real work when the user has a school selected.

| Area | What the staff actually get |
|---|---|
| Sign-in | Email and password. Teachers must confirm a 6-digit email code before the account is `active`. Management accounts are created `active` immediately if they know `MANAGEMENT_INVITE_CODE`. |
| School setup | Name, board, class list, program list, MOU start/end, GST prefix, phone, academic-year start month (default April), join code. Owner can clear school data by typing the school name. |
| Academic planning | Programs, batches, syllabus kanban, promotion preview and confirm. |
| Curriculum | Chapters, concepts, master curriculum, CSV import. Boards offered in the curriculum UI are CBSE, ICSE, ISC, State Board. |
| People | Student roster, guardians, CSV import, duplicate detection, delete. Faculty directory and faculty CSV import. |
| Teaching | Weekly timetable, one-off extra/doubt classes, attendance, daily class report, daily student ratings, PTM notes, counseling log, tests, question bank, test-result CSV import, study material. |
| Fees | Manual ledger. Structures, Excel import, record UPI / cash / card / cheque / DD, on-screen export. No payment gateway. |
| Reports | Hand-entered progress reports with a PDF view. A separate generator exists at `POST /api/reports/generate` and is not what the “Generate Report” button calls. |
| Other | Announcements (a modal on the management home, not its own page), meetings with a minutes PDF, calendar, recruitment CRUD. |

Management nav (`lib/navigation.tsx`) matches the pages that exist. Onboarding is intentionally hidden and enforced by `auth.config.ts`.

Teacher pages that exist but are **not in the teacher sidebar**:

- `/teacher/assignments` — assignment manager. API rejects non-teachers, so students cannot submit.
- `/teacher/feedback` — staff-to-management messages. This is not student ratings. Student ratings are the nav item “Student Ratings” (`/teacher/daily-ratings`).

`/teacher/courses` is in the nav as “Study Material”. It opens the assignments screen on the materials tab. It is not a course catalogue.

Empty directories with no page:

- `app/(dashboard)/management/quality/` — landing page still advertises Quality Monitoring.
- `app/(dashboard)/management/announcements/` — the feature lives inside `InstitutionalDashboard`.

Dead UI that nothing mounts:

- `components/dashboard/AcademicPlanning.tsx` — fake GPA / budget board. Its only data source is the open Mongo route below.
- `components/dashboard/management/RecruitmentDashboard.tsx` — older recruitment screen. The live page uses `RecruitmentView.tsx`.

---

## 4. Broken, and what will corrupt a client database

### 4.1 Open APIs (no session)

`proxy.ts` is the NextAuth gate. Its matcher is:

```ts
matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
```

Every `/api/*` route is outside that gate. Each handler has to call `auth()` itself. These do not.

| Route | What an anonymous caller can do |
|---|---|
| `GET/POST/PATCH/DELETE /api/academic-planning` | Read and write the shared Mongo milestone / metric collections. The first GET, when the collection is empty, inserts fake rows: “Annual Quality Audit” dated 2024-10-30, “Allocate $25k for lab equipment upgrades”, Overall GPA 3.6, Staff Capacity 92%, Budget Util. 64%, Staff Retention 96.8%. No school id. One global board for every deployment. |
| `GET /api/teacher-portal` | Reads every Mongo teacher schedule, counseling note, study-material row, and feedback row. If today’s schedule is empty it inserts “Test Conduction: Physics Mid-Term”, counseling notes for “Rahul Sharma” and “Priya Patel”, and materials named Allen Modules, Aakash Bank, and Motion DPPS. |
| `GET/POST/PATCH/DELETE /api/teacher-portal/schedule` | Full CRUD on the Mongo `TeacherSchedule` collection. No user, no school. |
| `GET/POST/PATCH/DELETE /api/recruitment/requirements` | Full CRUD on every school’s vacancies. |
| `GET/POST/PATCH/DELETE /api/recruitment/candidates` | Full CRUD on candidate name, email, phone, resume link, expected salary. `schoolId` is taken from the JSON body, so the caller chooses the tenant. |
| `GET/POST/PATCH/DELETE /api/recruitment/interviews` | Same, including interviewer feedback and offer result. |
| `GET/POST/PATCH/DELETE /api/recruitment/appraisals` | Same, for teacher performance reviews. Default “student feedback average” is the string `4.8`. |
| `GET/PATCH/DELETE /api/recruitment/audit-logs` | Read the last 100 audit rows across schools, then edit or delete them. The audit trail can be rewritten by anyone. |
| `GET /api/recruitment/dashboard` | Aggregates the four tables above, unfiltered. |
| `GET /api/recruitment/orientations` | Mongo. If empty, inserts “New Faculty Induction / Main Auditorium” and “LMS Training Workshop / Lab 3B”. |
| `GET /uploads/[filename]` | Reads a file from `public/uploads` with no session. `public/` is also statically served, so anything placed there is already public. |

The live recruitment screen (`RecruitmentView.tsx`) calls these recruitment routes from the browser. The page itself is behind the management login. The API is not. Anyone who can reach the deployed host can call them with curl.

`GET /api/schools?joinCode=` is intentionally public so signup can preview a school. It returns id, name, and board. That part is acceptable. `POST /api/schools` is a second school-create endpoint that does **not** attach the creator as owner (`addSchoolToAdmin` lives only on `POST /api/admin/schools`). A management user who hits the older route creates an orphan school and receives its join code.

### 4.2 Demo writers that run on a real school

**Fee seed.** `FeeManagementView.tsx` shows “Seed Sample Fee Data” whenever the school has zero structures and zero payments. `POST /api/fees/seed` (management-only, but one click) inserts:

- Registration ₹5,000, JEE Core tuition ₹12,500 for batch `JEE 2026-A`, Foundation 10 tuition ₹8,000, exam ₹2,500, material ₹15,000
- Academic year hardcoded `2024-25`
- Fake payments for the first 10 real students: transaction ids `TXN-2026-…`, receipt numbers, UPI/Card/Net Banking/Cash, and the note “Concession applied based on merit scholarship”

That is client fee data, not a fixture. Remove the button and the route before any demo on an empty ledger.

**Protocol seed.** `GET /api/protocols` counts rows for the school and, if zero, inserts:

- Child Safety Policy — “Reviewed: Oct 2023” — status completed
- Emergency Response Drill — “Overdue by 5 days”
- Data Privacy Agreement — “Signed & Active” — Sep 2023

The management home loads this on mount and presents it as the school’s compliance. A new client will see policies they never signed.

**Progress report form.** `ProgressReportView.tsx` opens a new report already filled with academic year `2025-2026`, principal remark “Good performance. Keep striving for excellence.”, Mathematics 85, Physics 78, Chemistry 82. Saving without editing stores those marks. The button says Generate Report and posts the typed form to `/api/reports/generated`. It does not call `POST /api/reports/generate` or `lib/reports/generate-report.ts`.

**Empty-state rating.** `GET /api/teacher/feedback` (Mongo, login required, no school filter) returns average rating `4.8` when there are zero feedback rows. The appraisal column `student_feedback_average` defaults to the same string.

### 4.3 Tenant filter that disappears

`lib/db/queries/students.ts`:

```ts
if (filters.schoolId) conditions.push(eq(students.schoolId, filters.schoolId))
```

`GET /api/students` always passes `session.user.schoolId`. When that value is null — a teacher who registered without a join code, or any session that has not been bound to a school — the condition is skipped and the query returns every active student in the database.

`GET /api/students/[id]` does the same with a ternary:

```ts
return schoolId ? and(eq(students.id, id), eq(students.schoolId, schoolId)) : eq(students.id, id)
```

The response includes `aadharNumber`, phone, address, and guardian rows (`annualIncome` is on `parents_guardians`).

The same `if (schoolId)` pattern is in attendance, assignments, meetings, tests, questions, feedback, daily reports, schedule, special classes, and teacher-portal stats. Happy-path users who have a school are scoped. Users without one are not, and the query helpers treat “no school” as “all schools” instead of “no rows”.

`schoolId` is also nullable on almost every tenant table. Only `school_invites`, `admin_schools`, and `generated_student_reports` require it. Rows can be inserted with a null school and then match no tenant filter, or match every unscoped query.

### 4.4 Two databases for one product

Postgres is the system of record for roster, fees, tests, attendance, curriculum, recruitment tables, and reports.

Mongo is still connected and still written by:

| Mongo model | Route |
|---|---|
| `AcademicPlanning` (Milestone, PlanningLog, AcademicMetric) | `app/api/academic-planning/route.ts` |
| `TeacherSchedule`, `StudentCounseling`, `StudyMaterial`, `TeacherFeedback` | `app/api/teacher-portal/route.ts` and `schedule/route.ts` |
| `Orientation` | `app/api/recruitment/orientations/route.ts` |
| `Feedback` | `app/api/teacher/feedback/route.ts` |

Postgres already has `class_schedules`, `counseling_sessions`, `study_materials`, `feedback`, and the recruitment tables. The Mongo copies are a second, unscoped source of truth. “Clear all school data” (`app/api/admin/clear-school-data/route.ts`) deletes Postgres rows only. Mongo demo rows survive a wipe.

Mongo models that no route imports anymore (dead): `Appraisal`, `Assignment`, `Attendance`, `CalendarEvent`, `Candidate`, `CounselingSession`, `DailyReport`, `Faculty`, `FeeType`, `PaymentRecord`, `Question`, `RecruitmentKPI`, `Requirement`, `Test`. They document the old schema. They are not the live one.

### 4.5 Class promotion does not match the school form

`lib/classPromotion.ts`:

```ts
export const NEXT_CLASS = { '9': '10', '10': '11', '11': '12' }
```

Class 12 and anyone whose `class` is not exactly `9`, `10`, or `11` is skipped. The school create form defaults `classes` to `Nursery – XII` or `6, 7, 8, 9, 10, 11, 12`, and programs include Foundational. A foundation or class 6–8 batch will never move. The cron is correctly protected by `CRON_SECRET`. The rule is the limit, and the promotion spec already says so.

### 4.6 Tests hit the client database

`lib/db/index.ts` states that Jest’s `DATABASE_URL` is the same database the app reads. There is no separate test database. A guard (`lib/db/dbGuard.ts`) blocks unscoped `DELETE` on a short list of tables (`users`, `schools`, `students`, `tests`, `questions`, `student_reports`, `student_report_entries`, `test_grades`) and, when it blocks, returns an empty result instead of throwing. Scoped deletes, updates, and inserts from tests still run against that database. `ALLOW_UNSCOPED_DELETES=true` turns the guard off. Do not run `npm test` against the client’s Neon URL.

---

## 5. Hardcoded values that a client will see

These are product defaults, not input placeholders.

| Where | Value | Effect |
|---|---|---|
| `schools` defaults and `POST /api/admin/schools` | Board `CBSE Affiliated`, programs `JEE, NEET, Foundational`, academic year starts in April | Every new school looks like one coaching brand until someone edits it. |
| `AcademicPlanningView.tsx`, `app/api/programs/route.ts` | Program type must be `JEE`, `NEET`, `Foundational`, or `Other` | A CBSE day school cannot name a real programme without using Other. |
| `fee_structures.academic_year` default, fee create form, fee seed | `2024-25` | In September 2026 an April-start school is in 2026-27. New fee rows file under the wrong year. |
| Progress report form | `2025-2026` | Same problem, different string format (`2025-2026` vs `2024-25` vs promotion’s `{year}-{year+1}`). |
| Appraisal defaults | Department `Science`, rating `5`, feedback `4.8`, overall `Excellent`, year `2025-2026` | A new appraisal looks completed and excellent before anyone reviews it. |
| Landing, sidebar help, PDF subtitles, roster export | `EduAdmin Pro`, © 2024 | Client-facing name is the template name. |
| Question paper export | Default institute “EduAdmin Pro Academy”, default batch `JEE 2026-A` | Exported papers carry the template unless the user overwrites every field. |
| CSV templates | Sample rows “Rahul Sharma”, “Aarav Sharma”, JEE Batch A/B | Harmless if treated as a template. Dangerous if someone uploads the sample file. |
| Syllabus kanban subject fallback | Physics, Chemistry, Mathematics, Biology, Botany, Zoology | Shown when the subject fetch has not returned the school’s own list. |
| `teacher_appraisals` and fee seed | Dollar-free but institute-specific copy (“JEE Core 2026”, “merit scholarship”) | Reads as another institute’s books. |

`scripts/clear-seed-data.mjs` still knows an older demo roster (named students, canned counseling and calendar text). It is a manual script, not a runtime seed. Do not point it at production without reading it.

There is no `.env.example` in the tree. `.gitignore` expects one (`!.env.example`). README lists the variables: `DATABASE_URL`, `MONGODB_URI`, `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `MANAGEMENT_INVITE_CODE`, `CRON_SECRET`. Blob uses Vercel OIDC rather than a static token.

---

## 6. Gaps against a real school or coaching centre

Grounded in what the code can and cannot do. This is the client-fit list for a September handoff.

**Parents and students cannot sign in.** `user_role` is only `teacher | management`. `students.user_id` and `parents_guardians.user_id` exist and are unused by auth. Announcements have a scope value “Parents” and nobody to deliver it to. “Message parent” is a `mailto:` / `wa.me` link, not SMS, WhatsApp Business, or in-app delivery. Fee and attendance notices cannot be sent inside the product.

**Fees cannot be paid online.** README says “payment gateway triggers, and PDF receipts.” There is no Razorpay, Stripe, or any gateway in the source. Staff type the amount, method, and transaction id. Receipt numbers are generated strings. The school stores `gstNo`, and nothing turns that into a GST invoice series. Installments are a free-text frequency (One-time, Monthly, Quarterly, Yearly), not a schedule engine.

**Academic year is three different strings.** Fees default `2024-25`. Report cards default `2025-2026`. Promotion builds `{startYear}-{startYear+1}` from `academic_year_start_month`. There is no `academic_terms` table. Term names are typed per report.

**Classes and programmes are an exam catalogue.** Promotion and batches are 9, 10, 11, 12, Repeater. The school form offers Nursery through XII. Foundational students in classes 6–8 have nowhere to be promoted. A school that teaches Commerce, Humanities, or primary cannot express that as a first-class programme.

**Multi-branch is not a concept.** There is no branch column. “Multi-tenant” means separate `schools` rows and an admin switcher. That is enough for two institutes on one deployment only after recruitment and the null-school queries are fixed. It is not a campus / branch model inside one school.

**Assignments are staff-only and hidden.** Students have no account to submit work. The teacher menu does not link to the page. Do not describe an assignment manager as shipped.

**Quality monitoring is a landing-page claim.** The route folder is empty. The only quality numbers in code are the Mongo GPA board that no page mounts.

**Report cards are typed, not computed.** Attendance, test grades, and daily ratings live in Postgres. The automated generator is a separate API. The screen the coordinator uses saves the form, including the sample 85 / 78 / 82 if they do not clear it. Parent email of the PDF is written up in the report spec as out of scope.

**One global management invite.** `POST /api/auth/register/management` compares the body to `MANAGEMENT_INVITE_CODE` and creates an `active` user with no email check and no school. Anyone with that code can create admin accounts. Teacher signup correctly requires OTP, and the join code is optional, so a teacher can exist with `schoolId = null` (which is the unscoped-query case in section 4.3).

**Roles are flat.** There is no principal, accountant, counselor, or coordinator permission. Every management user can edit fees, recruitment, and student identity data. Only the `owner` row in `admin_schools` can wipe the school. That wipe list itself is incomplete (section 8).

---

## 7. System design — what is right, what is not

### Right shape

- One `schools` row is the tenant. Users point at it with `schoolId` and, for management, `activeSchoolId`.
- Membership for admins is `admin_schools` (user, school, role), and switching schools checks that membership (`PATCH /api/admin/active-school`).
- Students, guardians, batches, attendance sessions, tests, questions, fees, and generated reports are relational and mostly cascaded from the school or the parent row.
- Class promotion is a detected run that a human confirms. The cron does not silently move students. That is the correct design for a school.
- Email OTP replaced magic links so a wrong `NEXT_PUBLIC_APP_URL` does not break verification. Passwords are bcrypt with cost 12. Minimum length is 8.
- The session re-reads the user from Postgres every five minutes (`SESSION_REVERIFY_INTERVAL_MS` in `lib/auth.ts`) so a deleted user or a school switch lands without a DB hit on every request.

### Wrong shape for a product you hand over

**Identity is split across names and emails.** Timetables store `teacherEmail` and `teacherName` as strings, not a foreign key to `users` or `faculty`. Teacher assignments store `batchName`, `subjectName`, and `programName` as strings even though `batches`, `subjects`, and `programs` tables exist. The schema comment on `teacher_subjects` still says “no subjects table exists”. Renaming a batch does not move attendance, fees, or syllabus rows that copied the old name. `students.batch` (string) and `students.batchId` (uuid) both exist, plus `student_batch_enrollments.batchName`. Three representations of the same fact.

**Dates are strings.** DOB, admission date, schedule dates, fee due dates, and MOU dates are `varchar(10)` or similar, not `date`. Sorting and range queries depend on `YYYY-MM-DD` discipline. Several time fields are free text (`09:00 AM`).

**Status is a string.** Fee status, student status, recruitment workflow, appraisal review, and assignment state are varchars with comments listing the allowed values. The database will accept anything the client sends. A few areas use real enums (`user_role`, `user_status`, test response status, faculty status). The rest do not.

**PII is plaintext operational data.** Aadhaar, phone, parent income, address, and resume links sit in ordinary columns and are returned by staff APIs. There is no field-level encryption, no retention rule, and no export/delete story for a parent asking for their child’s data. For an Indian school that is a product decision you need to make explicit before go-live, not an accident to discover later.

**Recruitment was migrated in schema and not in the handlers.** The tables have `schoolId`. The handlers still do `db.select().from(table)` with no session and no where clause, and they still speak Mongo (`_id` aliased from `id`). Orientations never moved off Mongo.

**The academic-planning Mongo board and the Postgres academic-planning page are different features that share a URL prefix.** `/management/academic-planning` renders `AcademicPlanningView` (programs and batches). `/api/academic-planning` is the abandoned KPI board. A reader of the README will think they are one module.

**“Clear all data” is not the inverse of “create school”.** It deletes students, schedules, attendance, calendar, counseling, student reports, faculty, study materials, daily reports, progress reports, assignments, feedback, announcements, notifications, recruitment rows, appraisals, audit logs, tests, and questions. It does not delete protocols, programs, batches, subjects, chapters, concepts, syllabus, master curriculum, fee structures, fee payments, daily ratings, PTM reports, meetings, or generated student reports. Child rows that cascade from a deleted parent go away. The rest remain, including the fake protocols and any seeded fees. Users and the school row stay, which is correct.

**Join-code generation is `Math.random`.** School join codes (`/api/admin/schools`, `/api/schools`, `lib/db/queries/school.ts`) use `Math.random`. OTP uses `crypto.randomInt`. Join codes are not passwords, but they are the only secret a teacher needs to attach to a school. Eight characters from a 32-symbol alphabet is fine if generation is cryptographic. It should use `crypto`.

---

## 8. Backend architecture and efficiency

### How a request runs

1. Browser calls a route handler.
2. The handler calls `auth()`, which may re-read the user (at most every five minutes).
3. Drizzle sends SQL over Neon’s HTTP API. There is no persistent connection pool. Each query is a round trip.
4. Many handlers then `select()` the whole table into memory and filter or count in JavaScript.

That is acceptable for a single small school. It will get slow, and expensive on Neon, as soon as attendance, test responses, or fee payments grow into tens of thousands of rows.

### Concrete hot spots

- **No pagination on operational lists.** `listStudents` returns every active student. Fee payments, questions, recruitment, announcements, and meetings do the same. The only `limit` calls in `lib/db/queries` are `limit(1)` lookups, plus the audit-log route’s `limit(100)`.
- **Counts load every row.** `countStudentsByClasses` does `select()` and returns `rows.length`. Protocol GET uses a real `count()`. Students do not.
- **Recruitment dashboard** loads all requirements, candidates, interviews, and appraisals, then reduces them in the route. Even after you add auth, this should be SQL aggregates filtered by `schoolId`.
- **Teacher feedback (Mongo)** loads every `Student -> Teacher` document to compute an average, then loads them again for the filtered list.
- **Dashboards fan out.** The management home, on mount, calls school, protocols, announcements, schedule, and special-classes. Each of those is its own serverless invocation and its own set of Neon HTTP calls.
- **Duplicate school-create and join-code helpers** live in three files (`app/api/schools/route.ts`, `app/api/admin/schools/route.ts`, `lib/db/queries/school.ts`). `getOrCreateSchool()` still does `select().from(schools).limit(1)` with no id, which returns whichever row Postgres hands back first. It is marked legacy. Anything that still calls it is not multi-school safe.
- **Error responses return `error.message`.** A Neon or Mongo exception string goes to the browser. That leaks query text and connection details and is also how a client will see raw database errors instead of a clean message.
- **Giant client components.** `RecruitmentView.tsx` is about 2,400 lines and owns every recruitment mutation. `SyllabusKanbanBoard.tsx` is in the same class. They work. They are the files that will break when you change a field, because the API contract (`_id` vs `id`, string statuses) is repeated in the component.

### What is in good shape

- Drizzle queries are parameterized. This is not a string-concat SQL codebase.
- Destructive school wipe requires the owner role and the school name typed back.
- Promotion confirm/dismiss routes are authenticated and covered by route tests.
- Students, tests, attendance, fees, curriculum, and reports have a real query module plus Jest tests beside them. Coverage is uneven (recruitment and the Mongo routes have none) but the newer Postgres work is tested on purpose.
- Session verification was deliberately moved off the per-request path. That comment in `lib/auth.ts` is accurate and worth keeping.

---

## 9. Security architecture

### What holds

- Page routes under `/management` and `/teacher` go through the NextAuth `authorized` callback. A teacher cannot open the management UI. A management user with no school is sent to onboarding. A logged-in user is bounced off `/login`.
- Passwords are hashed. Password reset and teacher verification use a 6-digit code, 10-minute expiry, 5 attempts, then the code is deleted. Forgot-password does not reveal whether the email exists, and it rate-limits resend to 30 seconds per user.
- School switch checks `admin_schools` before changing `activeSchoolId`.
- Cron requires `Authorization: Bearer ${CRON_SECRET}` and refuses to run if the secret is unset.
- Blob upload requires a session and stores objects private. The file name is stripped to a safe character set.

### What does not hold

**The API is not behind the middleware.** This is the structural issue. A missed `auth()` call is a public endpoint. Recruitment is the proof. Fixing this means a shared guard used by every handler, and a test that fails when a new `route.ts` does not call it. Putting `/api` behind the edge middleware is not enough on its own, because the edge config cannot see the database, but it would at least reject anonymous callers.

**Null school id means all tenants.** Section 4.3. The fix is: if the session has no school, return an empty list or 400. Never omit the predicate. `school_id` on tenant tables should be `NOT NULL` for new writes.

**Blob serve is an open redirect and an unscoped file read.** `GET /api/blob/serve` requires a session, then:

- If the `url` query contains `.blob.vercel-storage.com` and is not a public blob, it fetches that private object and streams it. Any logged-in user who knows or receives a URL can read another school’s paper, CV, or photo. There is no check that the path belongs to their school.
- Otherwise it `NextResponse.redirect(url)` for arbitrary absolute URLs.

Upload accepts any file, any size, and a client-chosen folder. There is no allow-list of content types.

**OTP and reset codes are stored in plaintext** (`email_verifications.otp`, `password_resets.otp`). Five attempts and a ten-minute life limit the window. A database leak still yields live codes. Hash them the way passwords are hashed.

**Account enumeration.** Verify-email and reset-password return “No account found for this email”. Register returns 409 when the email exists. Forgot-password is the one endpoint that stays generic. Make the other three match it.

**No login lockout.** Credentials sign-in has no attempt counter. OTP routes do. Password guessing against `/api/auth` is unbounded.

**Management signup skips verification** and depends on one shared invite code. Treat that code like a root password. Rotate it per client, and do not ship a default.

**Session school can be stale for five minutes.** Demoting a user or moving them off a school is not instant. That tradeoff is documented and reasonable. Do not lengthen the interval.

**Edge JWT callback trusts a client `update` payload** (`auth.config.ts` copies `session.schoolId` onto the token). The Node callback in `lib/auth.ts` then reloads the user when `trigger === 'update'`, so API routes that use `@/lib/auth` overwrite it from the database. Keep it that way. Do not read `schoolId` from the edge token alone inside a route.

**Security headers are absent.** `next.config.ts` only marks `pdf-parse` and `pdfjs-dist` as server externals. No CSP, no `X-Frame-Options` / `frame-ancestors`, no HSTS, no referrer policy. The admin UI can be framed by another site.

**Uploads path.** `app/uploads/[filename]/route.ts` joins the segment onto `public/uploads` and, if missing, redirects into the blob server. A single dynamic segment usually cannot contain a slash, so classic `../` traversal is limited, but the route is unauthenticated and the directory is already public. Do not put student documents there.

**Audit log is writable by the public** through `/api/recruitment/audit-logs`. After you add auth, audit rows should be insert-only.

**Aadhaar in API responses.** Staff of the school can read it, which may be what the client asked for. It must not leave the school boundary through the null-`schoolId` bug or the recruitment-style unscoped select.

---

## 10. What is solid and should not be rewritten this week

- Postgres schema for students, guardians, batches, attendance, tests, questions, responses, grades, fees, curriculum, and generated reports. It is large (about 60 tables, 57 SQL migrations) and it is the right place for new work.
- School membership and the active-school switch.
- Teacher email OTP, password reset, and the generic forgot-password response.
- Promotion as detect-then-confirm, with the cron secret.
- Owner-only school wipe with a typed school name (extend the table list, do not remove the guard).
- The newer route tests around promotions, students, attendance, fees, curriculum, and test grading. They are the pattern to copy onto recruitment.
- Syllabus kanban, faculty CSV, student CSV dedup, MOU dates, and test-result CSV import. The specs for those match the code more closely than the README’s marketing list does.

Do not start a second rewrite onto a new ORM or a new auth library before the end of the month. Close the holes in the design you already have.

---

## 11. Order of work for the remaining week

Do these before any client demo on a database you care about. Each item is a product fix, not a refactor.

1. **Put a session check on every recruitment route, the Mongo academic-planning route, both teacher-portal Mongo routes, and `/uploads/[filename]`.** Scope every query with the session school id. Ignore `schoolId` from the query string and the body (fee payments, fee structures, fee stats, and schedule already trust it). Make audit logs insert-only. Stop `notifyRoleInSchool` from running with a null school. Restrict `DELETE /api/students/bulk` to the school owner.
2. **Delete or disable the fee seed button and `POST /api/fees/seed`.** Delete the protocol auto-insert of the 2023 policies. Clear the progress-report form so a new report starts blank (no 85 / 78 / 82, no canned principal remark, academic year computed from the school’s start month).
3. **Treat a missing `schoolId` as zero rows, not all rows.** Change `listStudents` and the `if (schoolId)` handlers. Add a regression test that a teacher with a null school cannot read another school’s student.
4. **Stop writing Mongo from request handlers.** Point any UI that still needs schedule, counseling, materials, or feedback at the Postgres tables. Leave the Mongo models unread. You can drop `MONGODB_URI` once nothing imports `lib/mongodb.ts`.
5. **Rename the product in the UI** to the client’s name, or to a neutral name, including PDF headers and the © 2024 footer. Remove “EduAdmin Pro” and `JEE 2026-A` defaults from exports.
6. **Fix the academic-year default** to the current year for that school. One format. Use it in fees, reports, and appraisals.
7. **Tell the client the truth in the handover**, in writing: no parent app, no payment gateway, assignments are staff-only and off the menu, promotion is classes 9–12, programmes are JEE / NEET / Foundation / Other unless you spend the next change on making that list editable.
8. **Add `.env.example`** with empty values and a one-line note that Jest must not use the production `DATABASE_URL`. Add basic security headers. Hash OTPs if time remains.
9. **Extend the school wipe** to fees, meetings, PTM reports, ratings, curriculum, and generated reports, in a transaction. Do this after the seed buttons are gone, so a wipe is actually a wipe.
10. **Only then** decide the client-specific gaps that are still in scope for this contract: editable programme list, classes below 9, and whether assignments belong in the teacher nav. Parent login and a payment gateway are separate projects. They will not fit in the last week alongside the security work.

---

## 13. Extra architecture findings (confirmed in code)

These came out of the schema and migration pass after the first draft. Each one was checked against the file named.

**Curriculum writes a fake school when `schoolId` is missing.** `lib/db/queries/curriculum.ts` copies a chapter or concept into `master_curriculum` with:

```ts
schoolId: chapter.schoolId || '00000000-0000-0000-0000-000000000000'
```

The same sentinel is in `scripts/resync_all.ts`. Those rows are not attached to any real school, and the all-zero id is not a row in `schools`. A later backfill can mix every unscoped chapter into one bucket.

**There is no transaction anywhere.** A search for `db.transaction` across the TypeScript source returns nothing. The database client is Neon’s HTTP driver, which runs one statement per request. Class promotion updates students one at a time, then batches, then the run row. If the process dies in the middle, some students have moved and the run is still open.

**Receipt numbers are unique for the whole database**, not per school (`fee_payments.receipt_number` is `.unique()`). Two schools cannot issue `REC-2026-1001` at the same time. The fee seed uses that same series.

**A student can be rated once per date, by anyone, in the whole database.** `daily_student_ratings` is unique on `(studentId, date)` only. A second teacher rating the same student on the same day fails. The column is not scoped by school or by faculty. `facultyId` on that table references `users`, not `faculty`.

**Counseling does not point at a student.** `counseling_sessions` stores `studentName` and `studentInitials`. There is no `studentId`. Renaming a student, or two students with the same name, splits their counseling history. Deleting a student leaves the notes behind.

**A new assignment pretends the class has 40 students.** `assignments.total_students` defaults to 40. Completion percentages will be wrong until someone overwrites it.

**The teacher feedback screen reads two databases.** `TeacherFeedbackView.tsx` loads `/api/feedback` (Postgres, school-scoped when a school is set) and `/api/teacher/feedback` (Mongo, every school’s “Student -> Teacher” documents, and the fake 4.8 average when the collection is empty).

**`ScheduleModal.tsx` is unused and still targets Mongo.** Nothing imports it. It posts to `/api/teacher-portal/schedule`. The live timetable uses `/api/schedule` and the Postgres `class_schedules` table. The Mongo route remains deployed.

**Migrations will not rebuild a database from scratch.** `lib/db/migrations` contains 57 SQL files. `meta/_journal.json` lists 36 of them, out of order, and reuses numbers (`0011`, `0012`, `0013`, `0014`, `0017`, `0018` each exist twice on disk, and only one of each pair is in the journal). Files the journal does not run include `0010_multitenancy.sql`, `0017_scheduling_attendance.sql`, `0018_teachers_full_profile.sql`, `0019_protocols.sql` through `0028_password_resets.sql`, and the early `0005`–`0009` hand-written scripts. `npm run db:migrate` is `tsx migrate-http.ts`, which follows the journal. A brand-new Neon database will not match `schema.ts` unless those missing files were applied by hand on the current database. Do not assume `db:migrate` on a fresh client project produces the app you have been developing against. Check the live database against the schema before the handoff, and do not run Jest against it.

**Indexes the schema declares are thin.** `schema.ts` indexes are mostly unique keys, plus filters on `master_curriculum`, `student_reports`, and `generated_student_reports`. There is no index in the schema on `students.school_id`, `fee_payments.school_id`, `attendance_sessions.school_id`, or `tests.school_id`. Some of those indexes live only in SQL files the journal does not apply (`0010_multitenancy.sql`, `0017_scheduling_attendance.sql`). Foreign keys such as `attendance_entries.session_id` and `parents_guardians.student_id` are also not indexed in the schema. Postgres does not index foreign keys for you. List screens will seq-scan as the school grows.

**Three report stores overlap.** Imported rows live in `student_reports` / `student_report_entries` (entries match a student by name and roll number, not by `studentId`). Older cards live in `progress_reports`. The newer engine writes `generated_student_reports`, which is the one report table that requires `schoolId`. The progress-report screen writes the generated table from a hand-filled form. Staff can file the same child in all three and get three different percentages.

## 14. Security findings confirmed after the first draft

**Fee reads trust a school id from the URL.** `GET /api/fees/payments` is any logged-in user, including a teacher. It takes `schoolId` from the query string and only falls back to the session:

```ts
const schoolId = searchParams.get('schoolId') || session.user.schoolId || null
```

`listFeePayments` then filters only if that value is set. Passing another school’s id returns that school’s receipts, amounts, and transaction ids. Passing nothing, on a session that has no school, returns every payment in the database. The same override is the pattern to check on `GET /api/fees/structures` and `GET /api/fees/stats` before the handoff. School ids are not secret: `GET /api/schools?joinCode=` returns the school id to anyone who has the code, and the public recruitment rows store `schoolId` on the candidate.

**A management user can read every timetable.** `GET /api/schedule` treats `?schoolId=ALL` as “no school condition”, so the query is every school’s slots, including teacher emails. `?schoolId=<some other uuid>` is used as the filter with no check that this user belongs to that school. Teachers are narrower: a teacher with no school only sees rows whose `schoolId` is null, not every school. `GET /api/special-classes` needs the same check before you rely on it.

**Any teacher can delete the whole roster.** `DELETE /api/students/bulk` allows `teacher` and `management`. The comment on the handler says management only. `deleteAllStudents(schoolId)` deletes every student in that school. If `schoolId` is null it runs `db.delete(students)` with no `WHERE`. The db guard turns that unscoped delete into an empty success, so the route still responds `{ success: true }` and nothing is deleted. With a real school id, the guard does not apply, and the roster is gone.

**Public recruitment writes a notification to every user.** `POST /api/recruitment/interviews` has no session check and calls `notifyRoleInSchool(['teacher', 'management'], null, ...)`. In `lib/notify.ts`, a null school id skips the school filter and inserts one notification per teacher and management account in the database. The title and message come from the request. The same call with `null` is in the candidates and requirements handlers. Creating an interview is therefore also a way to spam every staff account.

**A test is visible across schools when either side has no school.** `loadAuthorizedTest` only rejects a mismatch when both the session and the test row have a `schoolId`. If the caller’s school is null, or the test’s school is null, the test is returned, including `paperUrl`.

**School settings accept the whole JSON body.** `PATCH /api/school` checks GST and phone, then `updateSchool` spreads the body onto the `schools` row. That is limited to the caller’s active school, and it includes `joinCode` and `isActive`. A management session can replace the join code or mark the school inactive without a separate confirmation.

**Reset codes can be raced.** The 6-digit code is stored in plaintext and compared with `!==`. The handler reads `attempts`, and only then increments. Parallel requests can all observe `attempts < 5`. After five failures the row is deleted, and forgot-password’s 30-second cooldown applies only while a previous row still exists, so a new code can be issued immediately. There is no limit per IP. Verify-email uses the same check-then-increment. Reset and verify also return 404 when the email does not exist.

## 12. How this review was done

- Read the README, `package.json`, `auth.config.ts`, `lib/auth.ts`, `proxy.ts`, `vercel.json`, `next.config.ts`, `lib/db/index.ts`, `lib/db/dbGuard.ts`, and the schema’s table list and `schoolId` columns.
- Opened every API area that creates, lists, or deletes tenant data, including fees seed, school create, clear-school-data, blob upload/serve, cron, registration, OTP, and recruitment.
- Listed route files that never call `auth()` or `CRON_SECRET`. Dynamic `[id]` paths were confirmed by hand where the shell could not read brackets.
- Compared the sidebar (`lib/navigation.tsx`) with the dashboard folders, including the empty `quality` and `announcements` directories and the teacher pages missing from the nav.
- Checked which `models/*.ts` files are still imported.
- Sampled the client-facing defaults (fee year, progress-report marks, protocol seed, programme enum, promotion map, EduAdmin branding) in the files named above.
- Did not run the app, the browser, Jest, or `next build`. Runtime behaviour of a specific client database (how many demo rows are already stored) is not in this file. The code paths that create those rows are.
