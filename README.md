# Academic Planning System

An enterprise-grade, multi-tenant Academic Planning and Management System built with **Next.js 16 (App Router)**, **React 19**, **Drizzle ORM**, **PostgreSQL (Neon)**, **MongoDB**, and **Tailwind CSS v4**.

Designed specifically for educational institutions, the platform hosts two distinct dashboards: **Management Portal** for coordinators/admins and **Teacher Portal** for faculty members, providing comprehensive control over academic operations.

---

## Key Features

### Management Portal (Admin & Coordinator Access)
* **Institutional Dashboard**: High-level metrics, enrollment charts, calendar overview, active school counts.
* **School Management**: Setup and configuration of schools (board affiliation, classes, programs, MOU start/end dates, join codes, and localized academic start months).
* **Program & Batch Creation**: Custom programs (JEE, NEET, Foundational, etc.) mapped to specific batches, class levels, teachers, calendar timelines, and student capacities.
* **Student Roster Management**: Filterable list of students, visual detail drawer, CSV import schema verification, custom duplicate detection logic, and single-click student deletion.
* **Faculty Directory**: Faculty profiles (qualification, streams, experience) and bulk CSV upload with template validations.
* **Fee Management**: Detailed tuition, transport, and library fee ledgers; invoices with installments, status tracking, payment gateway triggers, and PDF receipts.
* **Academic & Syllabus Tracking**: Central monitoring of chapter progress using Kanban boards with deadline indicators.
* **Recruitment & Applicant Pipeline**: Comprehensive applicant boards with columns for interview steps (Screening, Interview, Hired, Rejected).
* **Automated Class Promotion**: End-of-year boundary checking, batch migration preview counters, terminal class exclusions, and promotions auditing.
* **Daily Report Tracking**: Dashboard for tracking daily class summaries submitted by teachers.
* **Counseling Logs**: Central logging of academic, career, and personal counseling records.
* **Student Performance & Grading**: Term-based subject grade books and progress report card generation.
* **Standardized Question Bank**: Creation, filtering, and assembly of question papers; exports to PDF or Excel formats.

### Teacher Portal (Faculty Access)
* **Live Timetable & Doubt Classes**: Weekly recurring schedules and scheduled one-off classes (doubt clearing, extra classes).
* **Interactive Attendance Marking**: Session-based student attendance records (Present, Absent, Late, Excused).
* **Daily Class Reporting**: Fast filing of topics covered, homework assigned, absent counts, and class observations.
* **Syllabus Progress Kanban**: Drag-and-drop board to update chapter statuses (Not Started, In Progress, Completed) with visual deadline urgency indicators.
* **Assignment Manager**: Publishing of assignments, file attachments, deadlines, tracking submissions, grading workflows, and feedback input.
* **Standardized Question Bank**: Creation, filtering, and assembly of question papers; exports to PDF or Excel formats.
* **Student Counseling Concerns**: Direct logging of flags or concerns regarding students.
* **Feedback Monitoring**: Viewing student ratings and feedback remarks.

---

## Tech Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/) + [React 19](https://react.dev/)
- **Database**: [PostgreSQL (Neon Serverless)](https://neon.tech/) & [MongoDB](https://www.mongodb.com/)
- **ORM & Migrations**: [Drizzle ORM](https://orm.drizzle.team/) & [Drizzle Kit](https://orm.drizzle.team/kit-docs/overview)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) + [Framer Motion](https://www.framer.com/motion/) + [Lucide Icons](https://lucide.dev/)
- **Authentication**: [NextAuth.js (v5 Beta)](https://authjs.dev/) with Email OTP codes and secure credentials hashes (bcryptjs)
- **Reporting & File Exports**: `jspdf`, `jspdf-autotable`, `html2pdf.js`, `xlsx`
- **File Storage**: `@vercel/blob`
- **Email Delivery**: `nodemailer`
- **Testing**: `jest`, `@testing-library/react`

---

## Getting Started

### 1. Prerequisites
Ensure you have the following installed on your system:
* [Node.js](https://nodejs.org/) (v18+ recommended)
* A PostgreSQL instance (or [Neon database](https://neon.tech/))
* A MongoDB instance (used for legacy features)

### 2. Environment Variables Configuration
Set up your environment variables based on the standard configuration format. Make sure to populate:
- `DATABASE_URL`: Your PostgreSQL connection string.
- `MONGODB_URI`: Your MongoDB connection string.
- `AUTH_SECRET`: Secret key used to encrypt NextAuth tokens.
- `NEXT_PUBLIC_APP_URL`: App domain (e.g., `http://localhost:3000`).
- `GMAIL_USER` & `GMAIL_APP_PASSWORD`: SMTP credentials for Nodemailer OTP emails.
- `MANAGEMENT_INVITE_CODE`: Verification key for new management account registration.
- `CRON_SECRET`: Secret token for Vercel Cron verification on promotional cron jobs.

### 3. Install Dependencies
```bash
npm install
```

### 4. Database Setup & Migrations
We use **Drizzle Kit** to handle PostgreSQL migrations:
```bash
# Generate SQL migration scripts
npm run db:generate

# Apply migrations to your database
npm run db:migrate

# Open Drizzle Studio for visual database exploration
npm run db:studio
```

### 5. Running the App Locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) with your browser to see the application in action.

### 6. Running Tests
Tests are configured using Jest. To run the suite:
```bash
npm run test
```

---

## Documentation & Feature Specs

For deeper insights into recent enhancements, review the design files and implementation plans located inside the project documentation folders (such as the Automated Class Promotion Spec, Chapter & Batch Deadlines Spec, and Faculty Import Spec).