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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
