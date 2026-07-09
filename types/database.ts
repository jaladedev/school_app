export type UserRole = "student" | "teacher" | "admin";
export type NoteStatus = "draft" | "published" | "archived";
export type AttendanceStatus = "present" | "absent" | "late" | "excused";
export type ResourceType =
  | "image"
  | "diagram_mermaid"
  | "video"
  | "pdf"
  | "link"
  | "audio";

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface StudentProfile {
  id: string;
  admission_no: string | null;
  date_of_birth: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  class_id: string | null;
}

export interface ClassRow {
  id: string;
  name: string;
  arm: string | null;
  grade_level: number;
  class_teacher_id: string | null;
  academic_year: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string | null;
  min_grade_level: number | null;
  max_grade_level: number | null;
  description: string | null;
}

export interface CurriculumTopic {
  id: string;
  subject_id: string;
  grade_level: number;
  term: number;
  title: string;
  description: string | null;
  sequence_order: number;
}

export interface TopicNote {
  id: string;
  topic_id: string;
  author_id: string | null;
  content: string;
  status: NoteStatus;
  version: number;
  updated_at: string;
}

export interface TopicResource {
  id: string;
  topic_id: string;
  note_id: string | null;
  resource_type: ResourceType;
  title: string | null;
  content: string | null;
  file_url: string | null;
  sequence_order: number;
}

export interface TimetableEntry {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  weekday: number;
  period_number: number;
  start_time: string;
  end_time: string;
  room: string | null;
}

export interface TeacherProfile {
  id: string;
  staff_id: string | null;
  subjects_taught: string[] | null;
  hire_date: string | null;
}

export interface Lesson {
  id: string;
  timetable_entry_id: string | null;
  topic_id: string | null;
  class_id: string;
  teacher_id: string;
  lesson_date: string;
  objectives: string | null;
  homework: string | null;
}

export interface Attendance {
  id: string;
  lesson_id: string;
  student_id: string;
  status: AttendanceStatus;
  marked_by: string | null;
}

export interface Assessment {
  id: string;
  subject_id: string;
  class_id: string;
  title: string;
  max_score: number;
  weight_percent: number | null;
  term: number;
  academic_year: string;
  created_by: string | null;
}

export interface Grade {
  id: string;
  assessment_id: string;
  student_id: string;
  score: number;
  remark: string | null;
  graded_by: string | null;
}

export interface StudentNote {
  id: string;
  student_id: string;
  author_id: string | null;
  note_type: "behavioral" | "academic" | "commendation" | "disciplinary";
  content: string;
  visible_to_student: boolean;
}

export interface Announcement {
  id: string;
  author_id: string | null;
  title: string;
  content: string;
  audience: "all" | "students" | "teachers" | "class";
  class_id: string | null;
}

// Database type so @supabase/ssr's generics are satisfied.
// IMPORTANT: @supabase/supabase-js's generic constraint requires Tables, Views,
// Functions, Enums, and CompositeTypes to all be present on the schema object —
// even if empty. Omitting any of them causes TypeScript to silently fail the
// generic constraint check and collapse every Row type to `never`, which shows
// up as "Property 'x' does not exist on type 'never'" on every query result.
//
// Expand the Tables below with `supabase gen types typescript --linked` once
// the project is linked to your Supabase instance, for a fully accurate,
// auto-generated version of this file.
export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile>; Relationships: [] };
      student_profiles: { Row: StudentProfile; Insert: Partial<StudentProfile>; Update: Partial<StudentProfile>; Relationships: [] };
      classes: { Row: ClassRow; Insert: Partial<ClassRow>; Update: Partial<ClassRow>; Relationships: [] };
      subjects: { Row: Subject; Insert: Partial<Subject>; Update: Partial<Subject>; Relationships: [] };
      curriculum_topics: { Row: CurriculumTopic; Insert: Partial<CurriculumTopic>; Update: Partial<CurriculumTopic>; Relationships: [] };
      topic_notes: { Row: TopicNote; Insert: Partial<TopicNote>; Update: Partial<TopicNote>; Relationships: [] };
      topic_resources: { Row: TopicResource; Insert: Partial<TopicResource>; Update: Partial<TopicResource>; Relationships: [] };
      timetable_entries: { Row: TimetableEntry; Insert: Partial<TimetableEntry>; Update: Partial<TimetableEntry>; Relationships: [] };
      teacher_profiles: { Row: TeacherProfile; Insert: Partial<TeacherProfile>; Update: Partial<TeacherProfile>; Relationships: [] };
      lessons: { Row: Lesson; Insert: Partial<Lesson>; Update: Partial<Lesson>; Relationships: [] };
      attendance: { Row: Attendance; Insert: Partial<Attendance>; Update: Partial<Attendance>; Relationships: [] };
      assessments: { Row: Assessment; Insert: Partial<Assessment>; Update: Partial<Assessment>; Relationships: [] };
      grades: { Row: Grade; Insert: Partial<Grade>; Update: Partial<Grade>; Relationships: [] };
      student_notes: { Row: StudentNote; Insert: Partial<StudentNote>; Update: Partial<StudentNote>; Relationships: [] };
      announcements: { Row: Announcement; Insert: Partial<Announcement>; Update: Partial<Announcement>; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
