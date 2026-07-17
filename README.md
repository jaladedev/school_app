# School Management App

Next.js + Supabase frontend for the school management system (students, teachers, admin).

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Connect Supabase**
   - Create a project at https://supabase.com
   - In the SQL editor, run the four seed files from the schema project in order:
     `01_schema.sql` → `02_rls_policies.sql` → `03_seed_subject_topics.sql` → `04_seed_notes.sql`
   - Copy `.env.local.example` to `.env.local` and fill in your project URL + anon key
     (found in Supabase → Project Settings → API).

3. **Create a test student user**
   - In Supabase Auth, create a user (email + password)
   - Insert matching rows into `profiles` (role = 'student'), `student_profiles`,
     and `classes`/`enrollments` so the student is linked to a Primary 4 class —
     this is what makes the seeded Basic Science and Technology content show up.

4. **Run the dev server**
   ```bash
   npm run dev
   ```
   Visit http://localhost:3000/login

## What's built so far

- Auth (login) with middleware-protected `/dashboard` routes
- Role-based redirect (`/dashboard` → `/dashboard/student` etc.)
- Student flow: subjects list → topics by term → topic page rendering
  markdown notes, tables, and Mermaid diagrams from the seeded content
- Design tokens (notebook/paper theme) in `tailwind.config.ts` and `app/globals.css`

## Not yet built

- Signup flow (currently assumes admin creates accounts directly in Supabase)
- Teacher dashboard (lesson planning, attendance, grade entry, note authoring)
- Admin dashboard (user/class management, timetable builder)
- Timetable UI
- Messaging/announcements

## Structure

```
app/
  login/page.tsx                          — sign-in
  dashboard/
    layout.tsx                            — role-aware sidebar shell
    page.tsx                              — redirects by role
    student/
      page.tsx                            — subject list
      subjects/[subjectId]/page.tsx       — topics grouped by term
      topics/[topicId]/page.tsx           — rendered note + resources
components/
  Sidebar.tsx
  TopicContent.tsx                        — renders markdown + resources
  MermaidDiagram.tsx                       — renders mermaid syntax as SVG
lib/supabase/
  client.ts                               — browser client
  server.ts                                — server client + getCurrentProfile()
types/database.ts                         — types matching the SQL schema
middleware.ts                             — session refresh + route protection
```
