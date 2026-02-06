/**
 * Domain Enums - Status and type enumerations
 * El Sistema Punta Cana - Institutional WhatsApp Bot
 */

// ==========================================
// PERSON STATUS
// ==========================================

export enum ContactStatus {
    Active = 'active',
    Inactive = 'inactive',
    Archived = 'archived'
}

export enum ContactType {
    Guardian = 'guardian',
    Teacher = 'teacher',
    Staff = 'staff',
    Other = 'other'
}

export enum StudentStatus {
    Active = 'active',
    Inactive = 'inactive',
    Graduated = 'graduated',
    Withdrawn = 'withdrawn',
    OnLeave = 'on_leave'
}

export enum TeacherStatus {
    Active = 'active',
    Inactive = 'inactive',
    OnLeave = 'on_leave'
}

// ==========================================
// ACADEMIC
// ==========================================

export enum ProgramStatus {
    Active = 'active',
    Inactive = 'inactive',
    Archived = 'archived'
}

export enum LevelStatus {
    Active = 'active',
    Inactive = 'inactive'
}

export enum ClassGroupStatus {
    Active = 'active',
    Inactive = 'inactive',
    Completed = 'completed'
}

export enum EnrollmentStatus {
    Active = 'active',
    Completed = 'completed',
    Withdrawn = 'withdrawn',
    Transferred = 'transferred'
}

// ==========================================
// SESSIONS & ATTENDANCE
// ==========================================

export enum SessionStatus {
    Scheduled = 'scheduled',
    InProgress = 'in_progress',
    Completed = 'completed',
    Cancelled = 'cancelled'
}

export enum AttendanceStatus {
    Present = 'present',
    Absent = 'absent',
    Late = 'late',
    Excused = 'excused'
}

// ==========================================
// WHATSAPP
// ==========================================

export enum WhatsAppGroupType {
    ClassGroup = 'class_group',
    Program = 'program',
    Staff = 'staff',
    Announcement = 'announcement',
    Other = 'other'
}

export enum WhatsAppGroupStatus {
    Active = 'active',
    Inactive = 'inactive',
    Archived = 'archived'
}

// ==========================================
// TEMPLATES
// ==========================================

export enum TemplateCategory {
    Attendance = 'attendance',
    Reminder = 'reminder',
    Announcement = 'announcement',
    Welcome = 'welcome',
    Payment = 'payment',
    Event = 'event',
    General = 'general'
}

export enum TemplateStatus {
    Active = 'active',
    Inactive = 'inactive',
    Draft = 'draft'
}

// ==========================================
// KNOWLEDGE BASE
// ==========================================

export enum KnowledgeFileType {
    FAQ = 'faq',
    Policy = 'policy',
    Schedule = 'schedule',
    Contact = 'contact',
    Program = 'program',
    General = 'general'
}

export enum KnowledgeFileStatus {
    Active = 'active',
    Inactive = 'inactive',
    Processing = 'processing'
}

// ==========================================
// EVENTS & AUDIT
// ==========================================

export enum EventLogType {
    MessageSent = 'message_sent',
    MessageReceived = 'message_received',
    AttendanceRecorded = 'attendance_recorded',
    ContactCreated = 'contact_created',
    ContactUpdated = 'contact_updated',
    StudentCreated = 'student_created',
    StudentUpdated = 'student_updated',
    EnrollmentCreated = 'enrollment_created',
    SessionCreated = 'session_created',
    AutomationTriggered = 'automation_triggered',
    SystemError = 'system_error'
}

export enum EventLogLevel {
    Info = 'info',
    Warning = 'warning',
    Error = 'error',
    Debug = 'debug'
}

// ==========================================
// PROGRESS (Future)
// ==========================================

export enum ProgressStatus {
    NotStarted = 'not_started',
    InProgress = 'in_progress',
    Completed = 'completed',
    NeedsReview = 'needs_review'
}

// ==========================================
// DAYS OF WEEK
// ==========================================

export enum DayOfWeek {
    Monday = 'monday',
    Tuesday = 'tuesday',
    Wednesday = 'wednesday',
    Thursday = 'thursday',
    Friday = 'friday',
    Saturday = 'saturday',
    Sunday = 'sunday'
}
