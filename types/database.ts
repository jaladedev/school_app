export type UserRole = "student" | "teacher" | "admin";
export type NoteStatus = "draft" | "published" | "archived";
export type AttendanceStatus = "present" | "absent" | "late" | "excused";
export type StudentNoteType = "behavioral" | "academic" | "commendation" | "disciplinary";
export type AnnouncementAudience = "all" | "students" | "teachers" | "class";
export type ResourceType =
  | "image"
  | "diagram_mermaid"
  | "video"
  | "pdf"
  | "link"
  | "audio";

export type EducationLevel = "primary" | "jss" | "sss";

export function formatLevel(level: EducationLevel, levelNumber: number): string {
  if (level === "primary") return `Primary ${levelNumber}`;
  if (level === "jss") return `JSS ${levelNumber}`;
  return `SS ${levelNumber}`;
}

type GenericRelationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

export type Profile = {
  id: string;
  role: UserRole;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  must_change_password: boolean;
  is_active: boolean;
  created_at: string;
};

export type StudentProfile = {
  id: string;
  admission_no: string | null;
  date_of_birth: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  class_id: string | null;
};

export type TeacherProfile = {
  id: string;
  staff_id: string | null;
  subjects_taught: string[] | null;
  hire_date: string | null;
};

export type ClassRow = {
  id: string;
  name: string;
  arm: string | null;
  education_level: EducationLevel;
  level_number: number;
  class_teacher_id: string | null;
  academic_year: string;
  is_archived: boolean;
  created_at: string;
};

export type Enrollment = {
  id: string;
  student_id: string;
  class_id: string;
  academic_year: string;
  term: number;
  enrolled_at: string;
};

export type Subject = {
  id: string;
  name: string;
  code: string | null;
  education_level: EducationLevel;
  min_level_number: number;
  max_level_number: number;
  description: string | null;
};

export type CurriculumTopic = {
  id: string;
  subject_id: string;
  education_level: EducationLevel;
  level_number: number;
  term: number;
  title: string;
  description: string | null;
  sequence_order: number;
  created_by: string | null;
  created_at: string;
};

export type TopicNote = {
  id: string;
  topic_id: string;
  author_id: string | null;
  content: string;
  status: NoteStatus;
  version: number;
  created_at: string;
  updated_at: string;
};

export type TopicResource = {
  id: string;
  topic_id: string;
  note_id: string | null;
  resource_type: ResourceType;
  title: string | null;
  content: string | null;
  file_url: string | null;
  sequence_order: number;
  uploaded_by: string | null;
  created_at: string;
};

export type TimetableEntry = {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  weekday: number;
  period_number: number;
  start_time: string;
  end_time: string;
  room: string | null;
  academic_year: string;
  term: number;
};

export type Lesson = {
  id: string;
  timetable_entry_id: string | null;
  topic_id: string | null;
  class_id: string;
  teacher_id: string;
  lesson_date: string;
  objectives: string | null;
  homework: string | null;
  created_at: string;
};

export type Attendance = {
  id: string;
  lesson_id: string;
  student_id: string;
  status: AttendanceStatus;
  marked_by: string | null;
  marked_at: string;
};

export type Assessment = {
  id: string;
  subject_id: string;
  class_id: string;
  title: string;
  max_score: number;
  weight_percent: number | null;
  term: number;
  academic_year: string;
  created_by: string | null;
};

export type Grade = {
  id: string;
  assessment_id: string;
  student_id: string;
  score: number;
  remark: string | null;
  graded_by: string | null;
  graded_at: string;
};

export type StudentNote = {
  id: string;
  student_id: string;
  author_id: string | null;
  note_type: StudentNoteType;
  content: string;
  visible_to_student: boolean;
  created_at: string;
};

export type Announcement = {
  id: string;
  author_id: string | null;
  title: string;
  content: string;
  audience: AnnouncementAudience;
  class_id: string | null;
  created_at: string;
};

export type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  read: boolean;
  sent_at: string;
};

export type ReportCardRemark = {
  id: string;
  student_id: string;
  term: number;
  academic_year: string;
  class_teacher_remark: string | null;
  admin_remark: string | null;
  updated_by: string | null;
  updated_at: string;
};

export type GradeScaleEntry = { grade: string; min: number };

export type SchoolSettings = {
  id: number;
  name: string;
  logo_url: string | null;
  motto: string | null;
  address: string | null;
  current_academic_year: string;
  current_term: number;
  grade_scale: GradeScaleEntry[];
  updated_at: string;
};

export function scoreToLetterGrade(percent: number, scale: GradeScaleEntry[]): string {
  const sorted = [...scale].sort((a, b) => b.min - a.min);
  for (const entry of sorted) {
    if (percent >= entry.min) return entry.grade;
  }
  return sorted[sorted.length - 1]?.grade ?? "—";
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile>;
        Update: Partial<Profile>;
        Relationships: GenericRelationship[];
      };
      student_profiles: {
        Row: StudentProfile;
        Insert: Partial<StudentProfile>;
        Update: Partial<StudentProfile>;
        Relationships: GenericRelationship[];
      };
      teacher_profiles: {
        Row: TeacherProfile;
        Insert: Partial<TeacherProfile>;
        Update: Partial<TeacherProfile>;
        Relationships: GenericRelationship[];
      };
      classes: {
        Row: ClassRow;
        Insert: Partial<ClassRow>;
        Update: Partial<ClassRow>;
        Relationships: GenericRelationship[];
      };
      enrollments: {
        Row: Enrollment;
        Insert: Partial<Enrollment>;
        Update: Partial<Enrollment>;
        Relationships: GenericRelationship[];
      };
      subjects: {
        Row: Subject;
        Insert: Partial<Subject>;
        Update: Partial<Subject>;
        Relationships: GenericRelationship[];
      };
      curriculum_topics: {
        Row: CurriculumTopic;
        Insert: Partial<CurriculumTopic>;
        Update: Partial<CurriculumTopic>;
        Relationships: GenericRelationship[];
      };
      topic_notes: {
        Row: TopicNote;
        Insert: Partial<TopicNote>;
        Update: Partial<TopicNote>;
        Relationships: GenericRelationship[];
      };
      topic_resources: {
        Row: TopicResource;
        Insert: Partial<TopicResource>;
        Update: Partial<TopicResource>;
        Relationships: GenericRelationship[];
      };
      timetable_entries: {
        Row: TimetableEntry;
        Insert: Partial<TimetableEntry>;
        Update: Partial<TimetableEntry>;
        Relationships: GenericRelationship[];
      };
      lessons: {
        Row: Lesson;
        Insert: Partial<Lesson>;
        Update: Partial<Lesson>;
        Relationships: GenericRelationship[];
      };
      attendance: {
        Row: Attendance;
        Insert: Partial<Attendance>;
        Update: Partial<Attendance>;
        Relationships: GenericRelationship[];
      };
      assessments: {
        Row: Assessment;
        Insert: Partial<Assessment>;
        Update: Partial<Assessment>;
        Relationships: GenericRelationship[];
      };
      grades: {
        Row: Grade;
        Insert: Partial<Grade>;
        Update: Partial<Grade>;
        Relationships: GenericRelationship[];
      };
      student_notes: {
        Row: StudentNote;
        Insert: Partial<StudentNote>;
        Update: Partial<StudentNote>;
        Relationships: GenericRelationship[];
      };
      announcements: {
        Row: Announcement;
        Insert: Partial<Announcement>;
        Update: Partial<Announcement>;
        Relationships: GenericRelationship[];
      };
      messages: {
        Row: Message;
        Insert: Partial<Message>;
        Update: Partial<Message>;
        Relationships: GenericRelationship[];
      };
      report_card_remarks: {
        Row: ReportCardRemark;
        Insert: Partial<ReportCardRemark>;
        Update: Partial<ReportCardRemark>;
        Relationships: GenericRelationship[];
      };
      school_settings: {
        Row: SchoolSettings;
        Insert: Partial<SchoolSettings>;
        Update: Partial<SchoolSettings>;
        Relationships: GenericRelationship[];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};