/**
 * Domain Types - Entity interfaces
 * El Sistema Punta Cana - Institutional WhatsApp Bot
 * 
 * Conventions:
 * - All entities have: id, createdAt, updatedAt
 * - Timestamps are Unix seconds
 * - IDs are prefixed (see id.ts)
 */

import {
    ContactStatus,
    ContactType,
    StudentStatus,
    TeacherStatus,
    ProgramStatus,
    LevelStatus,
    ClassGroupStatus,
    EnrollmentStatus,
    SessionStatus,
    AttendanceStatus,
    WhatsAppGroupType,
    WhatsAppGroupStatus,
    TemplateCategory,
    TemplateStatus,
    KnowledgeFileType,
    KnowledgeFileStatus,
    EventLogType,
    EventLogLevel,
    ProgressStatus,
    DayOfWeek
} from './enums';

// ==========================================
// BASE ENTITY
// ==========================================

export interface BaseEntity {
    id: string;
    createdAt: number;  // Unix seconds
    updatedAt: number;  // Unix seconds
}

// ==========================================
// CONTACT (Guardian, Staff, Other)
// ==========================================

export interface Contact extends BaseEntity {
    // ID prefix: ct_
    firstName: string;
    lastName: string;
    displayName?: string;           // WhatsApp pushName or custom
    phones: string[];               // Normalized phone numbers
    preferredPhone?: string;        // Primary contact phone
    email?: string;
    type: ContactType;
    status: ContactStatus;
    
    // Relationships
    studentIds: string[];           // Students this contact is guardian of
    
    // WhatsApp
    whatsappJid?: string;           // Primary JID
    lastWhatsAppContact?: number;   // Last message timestamp
    
    // Metadata
    notes?: string;
    tags: string[];
}

// ==========================================
// STUDENT
// ==========================================

export interface Student extends BaseEntity {
    // ID prefix: st_
    firstName: string;
    lastName: string;
    dateOfBirth?: string;           // YYYY-MM-DD
    
    status: StudentStatus;
    enrollmentDate?: string;        // YYYY-MM-DD
    
    // Relationships
    contactIds: string[];           // Guardian contacts
    currentEnrollmentIds: string[]; // Active enrollments
    
    // Academic
    instruments: string[];
    primaryInstrument?: string;
    
    // Metadata
    notes?: string;
    tags: string[];
    photoUrl?: string;
}

// ==========================================
// TEACHER
// ==========================================

export interface Teacher extends BaseEntity {
    // ID prefix: tc_
    firstName: string;
    lastName: string;
    
    status: TeacherStatus;
    hireDate?: string;              // YYYY-MM-DD
    
    // Contact info
    contactId?: string;             // Link to Contact entity
    phone?: string;
    email?: string;
    
    // Teaching
    instruments: string[];          // Instruments they teach
    specializations: string[];      // Areas of expertise
    
    // Assignments
    classGroupIds: string[];        // Classes they teach
    
    // Metadata
    notes?: string;
    tags: string[];
    photoUrl?: string;
}

// ==========================================
// PROGRAM (e.g., "Violin Program", "Choir")
// ==========================================

export interface Program extends BaseEntity {
    // ID prefix: pg_
    name: string;
    code: string;                   // Short code (e.g., "VLN", "CHR")
    description?: string;
    
    status: ProgramStatus;
    
    // Structure
    levelIds: string[];             // Ordered list of levels
    
    // Metadata
    color?: string;                 // For UI display
    iconName?: string;
}

// ==========================================
// LEVEL (e.g., "Beginner", "Intermediate")
// ==========================================

export interface Level extends BaseEntity {
    // ID prefix: lv_
    name: string;
    code: string;                   // Short code (e.g., "L1", "L2")
    order: number;                  // Sequence within program
    description?: string;
    
    status: LevelStatus;
    
    // Relationships
    programId: string;              // Parent program
    
    // Requirements
    minAge?: number;
    maxAge?: number;
    prerequisites?: string[];       // Level IDs that must be completed
}

// ==========================================
// CLASS GROUP (e.g., "Violin Beginners A - Mon/Wed 3pm")
// ==========================================

export interface ClassGroup extends BaseEntity {
    // ID prefix: cl_
    name: string;
    code?: string;
    
    status: ClassGroupStatus;
    
    // Relationships
    programId: string;
    levelId: string;
    teacherIds: string[];           // Teachers assigned
    
    // Schedule
    schedule: ClassSchedule[];
    
    // WhatsApp
    whatsappGroupId?: string;       // Linked WhatsApp group
    
    // Capacity
    maxStudents?: number;
    
    // Metadata
    notes?: string;
    location?: string;
}

export interface ClassSchedule {
    dayOfWeek: DayOfWeek;
    startTime: string;              // HH:mm
    endTime: string;                // HH:mm
    location?: string;
}

// ==========================================
// ENROLLMENT (Student in ClassGroup)
// ==========================================

export interface Enrollment extends BaseEntity {
    // ID prefix: en_
    studentId: string;
    classGroupId: string;
    
    status: EnrollmentStatus;
    
    // Dates
    startDate: string;              // YYYY-MM-DD
    endDate?: string;               // YYYY-MM-DD (if completed/withdrawn)
    
    // Notes
    notes?: string;
}

// ==========================================
// SESSION (Single class instance)
// ==========================================

export interface Session extends BaseEntity {
    // ID prefix: ss_
    classGroupId: string;
    
    // Timing
    date: string;                   // YYYY-MM-DD
    scheduledStart: string;         // HH:mm
    scheduledEnd: string;           // HH:mm
    actualStart?: string;           // HH:mm
    actualEnd?: string;             // HH:mm
    
    status: SessionStatus;
    
    // Teachers
    teacherIds: string[];           // Who taught this session
    substituteTeacherId?: string;   // If substitute
    
    // Content
    topic?: string;
    notes?: string;
    
    // Attendance
    attendanceRecordIds: string[];
}

// ==========================================
// ATTENDANCE RECORD
// ==========================================

export interface AttendanceRecord extends BaseEntity {
    // ID prefix: ar_
    sessionId: string;
    studentId: string;
    enrollmentId: string;
    
    status: AttendanceStatus;
    
    // Details
    arrivalTime?: string;           // HH:mm (if late)
    notes?: string;
    
    // Recording
    recordedBy: string;             // Teacher/staff ID or 'system'
    recordedAt: number;             // Unix seconds
    
    // Notification
    guardianNotified: boolean;
    notifiedAt?: number;            // Unix seconds
}

// ==========================================
// WHATSAPP GROUP
// ==========================================

export interface WhatsAppGroup extends BaseEntity {
    // ID prefix: wa_
    jid: string;                    // WhatsApp group JID
    name: string;                   // Group name
    
    type: WhatsAppGroupType;
    status: WhatsAppGroupStatus;
    
    // Relationships
    classGroupId?: string;          // If linked to ClassGroup
    programId?: string;             // If program-wide group
    
    // Participants
    participantJids: string[];      // Member JIDs
    adminJids: string[];            // Admin JIDs
    
    // Settings
    botEnabled: boolean;            // Is bot active in this group
    announcementsOnly: boolean;     // Restrict to announcements
    
    // Metadata
    description?: string;
    lastActivityAt?: number;        // Unix seconds
}

// ==========================================
// TEMPLATE (Message templates)
// ==========================================

export interface Template extends BaseEntity {
    // ID prefix: tpl_
    name: string;
    code: string;                   // Unique identifier for programmatic use
    
    category: TemplateCategory;
    status: TemplateStatus;
    
    // Content
    body: string;                   // Template with {{variables}}
    description?: string;
    
    // Variables
    variables: string[];            // Extracted variable names
    requiredVariables: string[];    // Must be provided
    
    // Usage
    useCount: number;
    lastUsedAt?: number;            // Unix seconds
    
    // Metadata
    tags: string[];
}

// ==========================================
// KNOWLEDGE FILE (KB Index)
// ==========================================

export interface KnowledgeFile extends BaseEntity {
    // ID prefix: kb_
    name: string;
    filename: string;
    
    type: KnowledgeFileType;
    status: KnowledgeFileStatus;
    
    // Content
    content: string;                // Raw content
    summary?: string;               // AI-generated summary
    
    // Indexing
    keywords: string[];
    embeddings?: number[];          // Vector embeddings (future)
    
    // File info
    mimeType?: string;
    sizeBytes?: number;
    
    // Metadata
    source?: string;                // Where it came from
    lastIndexedAt?: number;         // Unix seconds
}

// ==========================================
// EVENT LOG (Audit trail)
// ==========================================

export interface EventLog extends BaseEntity {
    // ID prefix: ev_
    type: EventLogType;
    level: EventLogLevel;
    
    // Context
    entityType?: string;            // What entity was affected
    entityId?: string;              // Which entity
    actorId?: string;               // Who did it (user/system)
    actorType?: 'user' | 'system' | 'bot';
    
    // Details
    message: string;
    data?: Record<string, unknown>; // Additional data
    
    // Error info (if applicable)
    error?: string;
    stackTrace?: string;
}

// ==========================================
// STUDENT PROGRESS (Placeholder for future)
// ==========================================

export interface StudentProgress extends BaseEntity {
    // ID prefix: pr_
    studentId: string;
    enrollmentId?: string;
    
    // What
    skillName: string;
    skillCategory?: string;
    
    status: ProgressStatus;
    
    // Tracking
    startedAt?: number;             // Unix seconds
    completedAt?: number;           // Unix seconds
    
    // Assessment
    currentLevel?: number;          // 1-5 or similar
    targetLevel?: number;
    
    // Notes
    notes?: string;
    assessedBy?: string;            // Teacher ID
    assessedAt?: number;            // Unix seconds
}

// ==========================================
// QUERY/FILTER TYPES
// ==========================================

export interface PaginationParams {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface DateRangeFilter {
    startDate?: string;             // YYYY-MM-DD
    endDate?: string;               // YYYY-MM-DD
}

export interface SearchFilter {
    query?: string;
    fields?: string[];
}

// ==========================================
// CREATE/UPDATE TYPES
// ==========================================

export type CreateContact = Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateContact = Partial<Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>>;

export type CreateStudent = Omit<Student, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateStudent = Partial<Omit<Student, 'id' | 'createdAt' | 'updatedAt'>>;

export type CreateTeacher = Omit<Teacher, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateTeacher = Partial<Omit<Teacher, 'id' | 'createdAt' | 'updatedAt'>>;

export type CreateProgram = Omit<Program, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateProgram = Partial<Omit<Program, 'id' | 'createdAt' | 'updatedAt'>>;

export type CreateLevel = Omit<Level, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateLevel = Partial<Omit<Level, 'id' | 'createdAt' | 'updatedAt'>>;

export type CreateClassGroup = Omit<ClassGroup, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateClassGroup = Partial<Omit<ClassGroup, 'id' | 'createdAt' | 'updatedAt'>>;

export type CreateEnrollment = Omit<Enrollment, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateEnrollment = Partial<Omit<Enrollment, 'id' | 'createdAt' | 'updatedAt'>>;

export type CreateSession = Omit<Session, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateSession = Partial<Omit<Session, 'id' | 'createdAt' | 'updatedAt'>>;

export type CreateAttendanceRecord = Omit<AttendanceRecord, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateAttendanceRecord = Partial<Omit<AttendanceRecord, 'id' | 'createdAt' | 'updatedAt'>>;

export type CreateWhatsAppGroup = Omit<WhatsAppGroup, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateWhatsAppGroup = Partial<Omit<WhatsAppGroup, 'id' | 'createdAt' | 'updatedAt'>>;

export type CreateTemplate = Omit<Template, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateTemplate = Partial<Omit<Template, 'id' | 'createdAt' | 'updatedAt'>>;

export type CreateKnowledgeFile = Omit<KnowledgeFile, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateKnowledgeFile = Partial<Omit<KnowledgeFile, 'id' | 'createdAt' | 'updatedAt'>>;

export type CreateEventLog = Omit<EventLog, 'id' | 'createdAt' | 'updatedAt'>;

export type CreateStudentProgress = Omit<StudentProgress, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateStudentProgress = Partial<Omit<StudentProgress, 'id' | 'createdAt' | 'updatedAt'>>;

// ==========================================
// TRIGGER (Bot Activation Keywords)
// ==========================================

export interface Trigger extends BaseEntity {
    // ID prefix: tgr_
    keyword: string;
    matchType: 'exact' | 'contains' | 'startsWith' | 'regex';
    caseSensitive: boolean;
    enabled: boolean;
    description?: string;
    category?: string;
    priority: number;              // Higher priority = checked first
    
    // Stats
    matchCount?: number;            // Number of times matched
    lastMatchedAt?: number;        // Last time this trigger matched
}

export type CreateTrigger = Omit<Trigger, 'id' | 'createdAt' | 'updatedAt' | 'matchCount' | 'lastMatchedAt'>;
export type UpdateTrigger = Partial<Omit<Trigger, 'id' | 'createdAt' | 'updatedAt'>>;
