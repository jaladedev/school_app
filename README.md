# School Management App

A Next.js 14 + Supabase school management application for a Nigerian school workflow. The app is organized around admin, teacher, student, and parent roles, with a notebook-style UI and data-driven pages for academics, attendance, fees, messaging, and report cards.

## Overview

This project is a full-stack school ERP-style web app built with:

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth + Postgres + RLS
- Server actions for authenticated mutations

The app currently covers:

- Admin account lifecycle and password reset workflows
- Class, subject, timetable, and enrollment management
- Student and staff records
- Teacher lesson planning, attendance, assessments, and grade entry
- Curriculum notes with markdown + tables + Mermaid rendering
- Parent portal access for read-only child views
- Messaging and announcements
- Invoicing, payments, and printable receipts
- Report-card generation, ranking, and grading workflows

## Current status

The codebase is already beyond the early scaffold phase. The most recent work includes:

- stronger temporary-password generation and account-cleanup safeguards
- targeted role and RLS hardening across academic and parent flows
- announcement read-state UX polish
- shared toast feedback for save actions
- richer term/year selector syncing and dashboard polish

This README describes the current app state rather than the original starter-era behavior.

## Tech stack

- Next.js: 14.2.5
- React: 18
- TypeScript: 5
- Tailwind CSS: 3
- Supabase SSR / Supabase JS
- Zod validation
- Mermaid rendering for curriculum notes

## Local development

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a local environment file with the Supabase values used by the app.

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

These values come from your Supabase project in the Project Settings → API section.

### 3. Start the app

```bash
npm run dev
```

Then open:

```text
http://localhost:3000/login
```

## Available scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run format
npm run format:check
```

## Key product areas

### Admin

- Manage classes, subjects, staff, students, timetables, and school settings
- Create and reset user accounts
- Review moderation workflows and fee/invoice operations

### Teacher

- Create lesson plans from timetable slots
- Take attendance
- Create assessments and enter grades
- Author curriculum notes with draft/published status

### Student and parent

- View subject and topic materials
- Access schedule, attendance, grades, fees, report cards, announcements, and messages
- Parent accounts can switch across linked children

### Fees and receipts

- Fee structures and invoice generation
- Manual payment recording
- Paystack integration with server-side verification
- Printable receipt pages

### Reporting

- Weighted grade calculation paths
- Report-card generation
- Class ranking and grade moderation support

## Project structure

```text
app/                  — App Router pages and role-driven dashboard routes
components/          — reusable UI components and forms
lib/                 — server actions, helpers, validators, and Supabase integration
types/               — shared database typing
proxy.ts             — local request/proxy entry point used during development
```

## Notes for contributors

- The app uses Role-Based Access Control and Postgres RLS across many tables.
- Most page data is server rendered, while interactive pages stay in client components.
- The database typing file is maintained manually and should be kept aligned with the SQL schema.
- Work is tracked in the project todo list and should be reconciled with the actual codebase before being marked complete.

## License

This project is currently intended for internal or local development use within the workspace and is not yet packaged for public distribution.
