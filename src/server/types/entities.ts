/**
 * Entity Types for Institutional Data
 * 
 * These types define the core entities for "El Sistema Punta Cana" 
 * music institution management system.
 * 
 * MIGRATION NOTE: These interfaces are designed to be database-agnostic.
 * When migrating to Firestore, the repository implementations change,
 * but these types remain the same.
 */

// ==========================================
// Base Entity
// ==========================================

export interface BaseEntity {
    id: string;
    createdAt: string;
    updatedAt: string;
}

// ==========================================
// Contact (Parent/Guardian/External)
// ==========================================

export type ContactType = 'parent' | 'guardian' | 'external' | 'staff' | 'other';
export type ContactStatus = 'active' | 'inactive' | 'blocked';

export interface Contact extends BaseEntity {
    // Identity
    firstName: string;
    lastName: string;
    displayName?: string;
    
    // Communication
    phones: string[];           // Normalized E.164 format
    email?: string;
    preferredPhone?: string;    // Primary contact number
    
    // WhatsApp
    whatsappJid?: string;       // Current linked JID
    whatsappVerified: boolean;
    
    // Classification
    type: ContactType;
    status: ContactStatus;
    
    // Relationships
    studentIds: string[];       // Related students (children, etc.)
    
    // Metadata
    notes?: string;
    tags: string[];
    
    // Preferences
    notificationPreferences: {
        enabled: boolean;
        channels: ('whatsapp' | 'email')[];
        quietHoursStart?: string;  // HH:mm format
        quietHoursEnd?: string;
    };
}

// ==========================================
// Student
// ==========================================

export type StudentStatus = 'active' | 'inactive' | 'graduated' | 'suspended';
export type InstrumentLevel = 'beginner' | 'intermediate' | 'advanced';

export interface StudentInstrument {
    name: string;
    level: InstrumentLevel;
    startDate: string;
    isPrimary: boolean;
}

export interface Student extends BaseEntity {
    // Identity
    firstName: string;
    lastName: string;
    dateOfBirth?: string;       // YYYY-MM-DD
    
    // Enrollment
    enrollmentDate: string;
    status: StudentStatus;
    
    // Musical Profile
    instruments: StudentInstrument[];
    ensembles: string[];        // e.g., ["Orquesta Juvenil", "Coro"]
    
    // Relationships
    contactIds: string[];       // Parents/guardians
    
    // Academic
    currentClasses: string[];   // Class IDs
    
    // Metadata
    notes?: string;
    tags: string[];
    
    // Photo (optional base64 or URL)
    photoUrl?: string;
}

// ==========================================
// Attendance
// ==========================================

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | 'unknown';

export interface AttendanceRecord {
    studentId: string;
    status: AttendanceStatus;
    arrivalTime?: string;       // HH:mm
    notes?: string;
    recordedBy?: string;        // Staff ID or 'system'
    recordedAt: string;         // ISO timestamp
}

export interface DailyAttendance {
    date: string;               // YYYY-MM-DD
    classId?: string;           // Optional: specific class
    ensembleId?: string;        // Optional: specific ensemble
    records: AttendanceRecord[];
    createdAt: string;
    updatedAt: string;
}

export interface AttendanceData {
    version: number;
    byDate: Record<string, DailyAttendance>;  // Key: YYYY-MM-DD
}

// ==========================================
// Template (Message Templates)
// ==========================================

export type TemplateCategory = 
    | 'attendance' 
    | 'reminder' 
    | 'announcement' 
    | 'event' 
    | 'greeting' 
    | 'follow-up'
    | 'custom';

export interface TemplateVariable {
    name: string;
    description?: string;
    required: boolean;
    defaultValue?: string;
}

export interface Template extends BaseEntity {
    // Identity
    name: string;
    slug: string;               // URL-friendly identifier
    
    // Content
    body: string;               // Template with {{variables}}
    
    // Classification
    category: TemplateCategory;
    
    // Variables
    variables: TemplateVariable[];
    
    // Usage
    isActive: boolean;
    usageCount: number;
    lastUsedAt?: string;
    
    // Metadata
    description?: string;
    tags: string[];
}

// ==========================================
// Phone Index (Phone -> Contact mapping)
// ==========================================

export interface PhoneIndexEntry {
    phone: string;              // Normalized E.164
    contactId: string;
    linkedAt: string;
    source: 'manual' | 'whatsapp' | 'import';
}

export interface PhoneIndexData {
    version: number;
    lastUpdated: string;
    index: Record<string, PhoneIndexEntry>;  // Key: normalized phone
}

// ==========================================
// Automation Rules
// ==========================================

export type AutomationTrigger = 
    | 'absence_detected'
    | 'repeated_absence'
    | 'new_message'
    | 'keyword_match'
    | 'schedule_time'
    | 'event_reminder';

export type AutomationAction =
    | 'send_message'
    | 'create_alert'
    | 'tag_contact'
    | 'log_event';

export interface AutomationCondition {
    field: string;
    operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'matches';
    value: string | number;
}

export interface Automation extends BaseEntity {
    name: string;
    description?: string;
    
    // Trigger
    trigger: AutomationTrigger;
    conditions: AutomationCondition[];
    
    // Action
    action: AutomationAction;
    actionConfig: Record<string, any>;
    
    // Targeting
    targetGroups?: string[];    // WhatsApp group JIDs
    targetContacts?: string[];  // Contact IDs
    
    // Status
    isActive: boolean;
    lastTriggeredAt?: string;
    triggerCount: number;
    
    // Schedule (for scheduled automations)
    schedule?: {
        type: 'once' | 'daily' | 'weekly' | 'monthly';
        time?: string;          // HH:mm
        dayOfWeek?: number;     // 0-6
        dayOfMonth?: number;    // 1-31
        nextRunAt?: string;
    };
}

export interface AutomationsData {
    version: number;
    lastUpdated: string;
    automations: Automation[];
}

// ==========================================
// Knowledge Index (for fast FAQ lookup)
// ==========================================

export interface KnowledgeIndexEntry {
    faqId: string;
    keywords: string[];
    variations: string[];
    category: string;
    lastUpdated: string;
}

export interface KnowledgeIndexData {
    version: number;
    lastRebuilt: string;
    entries: KnowledgeIndexEntry[];
    keywordMap: Record<string, string[]>;  // keyword -> faqIds
}

// ==========================================
// Repository Interfaces (for Firestore migration)
// ==========================================

export interface IRepository<T extends BaseEntity> {
    findById(id: string): Promise<T | null>;
    findAll(): Promise<T[]>;
    create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
    update(id: string, updates: Partial<T>): Promise<T | null>;
    delete(id: string): Promise<boolean>;
}

export interface IContactsRepository extends IRepository<Contact> {
    findByPhone(phone: string): Promise<Contact | null>;
    findByJid(jid: string): Promise<Contact | null>;
    findByStudentId(studentId: string): Promise<Contact[]>;
}

export interface IStudentsRepository extends IRepository<Student> {
    findByContactId(contactId: string): Promise<Student[]>;
    findByEnsemble(ensemble: string): Promise<Student[]>;
    findActive(): Promise<Student[]>;
}

export interface ITemplatesRepository extends IRepository<Template> {
    findBySlug(slug: string): Promise<Template | null>;
    findByCategory(category: TemplateCategory): Promise<Template[]>;
    findActive(): Promise<Template[]>;
}

export interface IAttendanceRepository {
    getByDate(date: string): Promise<DailyAttendance | null>;
    getByDateRange(startDate: string, endDate: string): Promise<DailyAttendance[]>;
    saveDaily(attendance: DailyAttendance): Promise<void>;
    getStudentAttendance(studentId: string, startDate: string, endDate: string): Promise<AttendanceRecord[]>;
}

export interface IPhoneIndexRepository {
    lookup(phone: string): Promise<PhoneIndexEntry | null>;
    link(phone: string, contactId: string, source: PhoneIndexEntry['source']): Promise<void>;
    unlink(phone: string): Promise<boolean>;
    getContactPhones(contactId: string): Promise<string[]>;
}
