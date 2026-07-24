export type UserRole = "student" | "teacher" | "admin" | "parent";
export type NoteStatus = "draft" | "published" | "archived";
export type AttendanceStatus = "present" | "absent" | "late" | "excused";
export type StudentNoteType = "behavioral" | "academic" | "commendation" | "disciplinary";
export type AnnouncementAudience = "all" | "students" | "teachers" | "class";
export type HomeworkStatus = "given" | "reviewed" | "graded";
export type AssessmentType =
  "first_ca" | "second_ca" | "exam" | "test" | "assignment" | "project" | "practical" | "other";
export type InvoiceStatus = "unpaid" | "partial" | "paid";
export type PaymentMethod = "cash" | "bank_transfer" | "card" | "other";
export type StaffRole = "teacher" | "hod" | "bursar";
export type GradeModerationStatus = "pending" | "approved";
export type ResourceType = "image" | "diagram_mermaid" | "video" | "pdf" | "link" | "audio";

export type EducationLevel = "primary" | "jss" | "sss";

export function formatLevel(level: EducationLevel, levelNumber: number): string {
  if (level === "primary") return `Primary ${levelNumber}`;
  if (level === "jss") return `JSS ${levelNumber}`;
  return `SS ${levelNumber}`;
}

export function formatKobo(kobo: number): string {
  const naira = kobo / 100;
  return `₦${naira.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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
  staff_role: StaffRole;
};

export type GuardianLink = {
  id: string;
  parent_id: string;
  student_id: string;
  relationship: string | null;
  is_primary: boolean;
  created_at: string;
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
  academic_year: string;
  title: string;
  description: string | null;
  sequence_order: number;
  week_number: number;
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
  homework_status: HomeworkStatus;
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
  assessment_type: AssessmentType;
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
  moderation_status: GradeModerationStatus;
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

export type ConversationArchive = {
  user_id: string;
  partner_id: string;
  archived_at: string;
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
  current_term_start_date: string | null;
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

export type FeeStructure = {
  id: string;
  education_level: EducationLevel;
  level_number: number;
  term: number;
  academic_year: string;
  title: string;
  amount_kobo: number;
  due_date: string | null;
  created_by: string | null;
  created_at: string;
};

export type Invoice = {
  id: string;
  student_id: string;
  fee_structure_id: string;
  term: number;
  academic_year: string;
  total_amount_kobo: number;
  discount_kobo: number;
  amount_paid_kobo: number;
  status: InvoiceStatus;
  created_at: string;
};

export type Payment = {
  id: string;
  invoice_id: string;
  student_id: string;
  amount_kobo: number;
  method: PaymentMethod;
  reference: string | null;
  verified_by: string | null;
  paid_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile>;
        Update: Partial<Profile>;
        Relationships: [];
      };
      student_profiles: {
        Row: StudentProfile;
        Insert: Partial<StudentProfile>;
        Update: Partial<StudentProfile>;
        Relationships: [
          {
            foreignKeyName: "student_profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_student_class";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      teacher_profiles: {
        Row: TeacherProfile;
        Insert: Partial<TeacherProfile>;
        Update: Partial<TeacherProfile>;
        Relationships: [
          {
            foreignKeyName: "teacher_profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      guardian_links: {
        Row: GuardianLink;
        Insert: Partial<GuardianLink>;
        Update: Partial<GuardianLink>;
        Relationships: [
          {
            foreignKeyName: "guardian_links_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guardian_links_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "student_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      classes: {
        Row: ClassRow;
        Insert: Partial<ClassRow>;
        Update: Partial<ClassRow>;
        Relationships: [
          {
            foreignKeyName: "classes_class_teacher_id_fkey";
            columns: ["class_teacher_id"];
            isOneToOne: false;
            referencedRelation: "teacher_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      enrollments: {
        Row: Enrollment;
        Insert: Partial<Enrollment>;
        Update: Partial<Enrollment>;
        Relationships: [
          {
            foreignKeyName: "enrollments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "student_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "enrollments_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      subjects: {
        Row: Subject;
        Insert: Partial<Subject>;
        Update: Partial<Subject>;
        Relationships: [];
      };
      curriculum_topics: {
        Row: CurriculumTopic;
        Insert: Partial<CurriculumTopic>;
        Update: Partial<CurriculumTopic>;
        Relationships: [
          {
            foreignKeyName: "curriculum_topics_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "curriculum_topics_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      topic_notes: {
        Row: TopicNote;
        Insert: Partial<TopicNote>;
        Update: Partial<TopicNote>;
        Relationships: [
          {
            foreignKeyName: "topic_notes_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "curriculum_topics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "topic_notes_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      topic_resources: {
        Row: TopicResource;
        Insert: Partial<TopicResource>;
        Update: Partial<TopicResource>;
        Relationships: [
          {
            foreignKeyName: "topic_resources_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "curriculum_topics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "topic_resources_note_id_fkey";
            columns: ["note_id"];
            isOneToOne: false;
            referencedRelation: "topic_notes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "topic_resources_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      timetable_entries: {
        Row: TimetableEntry;
        Insert: Partial<TimetableEntry>;
        Update: Partial<TimetableEntry>;
        Relationships: [
          {
            foreignKeyName: "timetable_entries_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "timetable_entries_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "timetable_entries_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teacher_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      lessons: {
        Row: Lesson;
        Insert: Partial<Lesson>;
        Update: Partial<Lesson>;
        Relationships: [
          {
            foreignKeyName: "lessons_timetable_entry_id_fkey";
            columns: ["timetable_entry_id"];
            isOneToOne: false;
            referencedRelation: "timetable_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lessons_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "curriculum_topics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lessons_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teacher_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance: {
        Row: Attendance;
        Insert: Partial<Attendance>;
        Update: Partial<Attendance>;
        Relationships: [
          {
            foreignKeyName: "attendance_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "student_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_marked_by_fkey";
            columns: ["marked_by"];
            isOneToOne: false;
            referencedRelation: "teacher_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      assessments: {
        Row: Assessment;
        Insert: Partial<Assessment>;
        Update: Partial<Assessment>;
        Relationships: [
          {
            foreignKeyName: "assessments_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessments_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "teacher_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      grades: {
        Row: Grade;
        Insert: Partial<Grade>;
        Update: Partial<Grade>;
        Relationships: [
          {
            foreignKeyName: "grades_assessment_id_fkey";
            columns: ["assessment_id"];
            isOneToOne: false;
            referencedRelation: "assessments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "grades_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "student_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "grades_graded_by_fkey";
            columns: ["graded_by"];
            isOneToOne: false;
            referencedRelation: "teacher_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      student_notes: {
        Row: StudentNote;
        Insert: Partial<StudentNote>;
        Update: Partial<StudentNote>;
        Relationships: [
          {
            foreignKeyName: "student_notes_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "student_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_notes_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      announcements: {
        Row: Announcement;
        Insert: Partial<Announcement>;
        Update: Partial<Announcement>;
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "announcements_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: Message;
        Insert: Partial<Message>;
        Update: Partial<Message>;
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      conversation_archives: {
        Row: ConversationArchive;
        Insert: Partial<ConversationArchive>;
        Update: Partial<ConversationArchive>;
        Relationships: [
          {
            foreignKeyName: "conversation_archives_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversation_archives_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      report_card_remarks: {
        Row: ReportCardRemark;
        Insert: Partial<ReportCardRemark>;
        Update: Partial<ReportCardRemark>;
        Relationships: [
          {
            foreignKeyName: "report_card_remarks_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "student_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_card_remarks_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      school_settings: {
        Row: SchoolSettings;
        Insert: Partial<SchoolSettings>;
        Update: Partial<SchoolSettings>;
        Relationships: [];
      };
      fee_structures: {
        Row: FeeStructure;
        Insert: Partial<FeeStructure>;
        Update: Partial<FeeStructure>;
        Relationships: [
          {
            foreignKeyName: "fee_structures_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: Invoice;
        Insert: Partial<Invoice>;
        Update: Partial<Invoice>;
        Relationships: [
          {
            foreignKeyName: "invoices_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "student_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_fee_structure_id_fkey";
            columns: ["fee_structure_id"];
            isOneToOne: false;
            referencedRelation: "fee_structures";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: Payment;
        Insert: Partial<Payment>;
        Update: Partial<Payment>;
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "student_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_scheme_week: {
        Args: Record<string, never>;
        Returns: number | null;
      };
      invoice_dashboard_totals: {
        Args: {
          p_academic_year?: string | null;
          p_term?: number | null;
        };
        Returns: {
          total_billed: number;
          total_collected: number;
          total_outstanding: number;
          unpaid_invoice_count: number;
        }[];
      };
      record_invoice_payment: {
        Args: {
          p_amount_kobo: number;
          p_enforce_balance: boolean;
          p_invoice_id: string;
          p_method: PaymentMethod;
          p_reference: string | null;
          p_verified_by: string | null;
        };
        Returns: {
          already_recorded: boolean;
          amount_paid_kobo: number;
          payment_id: string;
          status: InvoiceStatus;
          student_id: string;
        }[];
      };
    };
  };
};
