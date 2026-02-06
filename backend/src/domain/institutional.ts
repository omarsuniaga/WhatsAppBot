/**
 * Institutional Domain Models
 * Data models for Students, Classes, Attendance, Events, Drafts, and Tickets
 */

// ============================================================================
// ENUMS
// ============================================================================

export enum Program {
  Coro = 'coro',
  Orquesta = 'orquesta',
  Iniciacion = 'iniciacion',
  Preparatoria = 'preparatoria'
}

export enum StudentStatus {
  Active = 'active',
  Inactive = 'inactive',
  Graduated = 'graduated'
}

export enum AttendanceStatus {
  Present = 'present',
  Absent = 'absent',
  Late = 'late',
  Excused = 'excused'
}

export enum EnrollmentStatus {
  Active = 'active',
  Withdrawn = 'withdrawn',
  Completed = 'completed'
}

export enum EventType {
  Rehearsal = 'rehearsal',
  Concert = 'concert',
  ParentMeeting = 'meeting',
  Masterclass = 'masterclass',
  Audition = 'audition',
  Administrative = 'admin',
  Other = 'other'
}

export enum EventStatus {
  Scheduled = 'scheduled',
  Completed = 'completed',
  Cancelled = 'cancelled'
}

export enum ReminderStatus {
  Pending = 'pending',
  DraftCreated = 'draft_created',
  Sent = 'sent',
  Failed = 'failed'
}

export enum DraftStatus {
  Pending = 'pending',
  Approved = 'approved',
  Sent = 'sent',
  Failed = 'failed',
  Cancelled = 'cancelled'
}

export enum DraftSource {
  Attendance = 'attendance',
  Event = 'event',
  Schedule = 'schedule',
  Manual = 'manual',
  Ticket = 'ticket'
}

export enum TicketStatus {
  Pending = 'pending',
  InProgress = 'in_progress',
  Resolved = 'resolved',
  Dismissed = 'dismissed'
}

export enum TicketPriority {
  High = 'high',
  Normal = 'normal',
  Low = 'low'
}

export enum TicketResolution {
  Responded = 'responded',
  SavedFaq = 'saved_faq',
  Assigned = 'assigned',
  Dismissed = 'dismissed'
}

export enum EventLogType {
  // Attendance
  AttendanceMarked = 'attendance_marked',
  AttendanceRuleTriggered = 'attendance_rule_triggered',
  
  // Events
  EventCreated = 'event_created',
  EventUpdated = 'event_updated',
  EventCancelled = 'event_cancelled',
  EventReminderTriggered = 'event_reminder_triggered',
  
  // Messages
  DraftCreated = 'draft_created',
  DraftApproved = 'draft_approved',
  DraftCancelled = 'draft_cancelled',
  MessageSent = 'message_sent',
  MessageFailed = 'message_failed',
  
  // Tickets
  TicketCreated = 'ticket_created',
  TicketAssigned = 'ticket_assigned',
  TicketResolved = 'ticket_resolved',
  
  // Students & Classes
  StudentCreated = 'student_created',
  StudentUpdated = 'student_updated',
  ClassCreated = 'class_created',
  EnrollmentCreated = 'enrollment_created',
  
  // Schedule
  ScheduleChanged = 'schedule_changed',
  SchedulePublished = 'schedule_published',
  
  // System
  SystemError = 'system_error',
  ConfigChanged = 'config_changed'
}

// ============================================================================
// BASE INTERFACE
// ============================================================================

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// STUDENT
// ============================================================================

export interface Student extends BaseEntity {
  firstName: string;
  lastName: string;
  displayName?: string;
  program: Program;
  instrument?: string;
  level: string;
  birthDate?: string;
  contactIds: string[];
  status: StudentStatus;
  notes?: string;
  tags: string[];
}

// ============================================================================
// CLASS GROUP
// ============================================================================

export interface Schedule {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
}

export interface ClassGroup extends BaseEntity {
  name: string;
  program: Program;
  level: string;
  teacherId: string;
  room?: string;
  capacity?: number;
  schedules: Schedule[];
  waGroupJid?: string;
  botEnabled: boolean;
  status: 'active' | 'inactive';
}

// ============================================================================
// ENROLLMENT
// ============================================================================

export interface Enrollment extends BaseEntity {
  studentId: string;
  classGroupId: string;
  enrolledAt: string;
  status: EnrollmentStatus;
  notes?: string;
}

// ============================================================================
// SESSION (Class Instance)
// ============================================================================

export interface Session extends BaseEntity {
  classGroupId: string;
  date: string;        // YYYY-MM-DD
  startTime: string;   // HH:mm
  endTime: string;     // HH:mm
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
}

// ============================================================================
// ATTENDANCE
// ============================================================================

export interface AttendanceRecord extends BaseEntity {
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  note?: string;
  markedBy: string;
  markedAt: string;
}

export interface AttendanceRuleCondition {
  metric: 'absences' | 'lates';
  threshold: number;
  periodDays: number;
}

export interface AttendanceRuleAction {
  type: 'generate_draft';
  templateId: string;
  targetType: 'primary_contact' | 'all_contacts';
}

export interface AttendanceRule extends BaseEntity {
  name: string;
  condition: AttendanceRuleCondition;
  action: AttendanceRuleAction;
  isActive: boolean;
  lastRunAt?: string;
}

// ============================================================================
// EVENT
// ============================================================================

export interface Event extends BaseEntity {
  title: string;
  type: EventType;
  date: string;        // YYYY-MM-DD
  startTime: string;   // HH:mm
  endTime?: string;
  location?: string;
  description?: string;
  
  // Targeting
  targetPrograms: Program[];
  targetClassGroupIds: string[];
  targetWaGroupJids: string[];
  targetContactIds: string[];
  
  // Notifications
  enableReminders: boolean;
  templateId?: string;
  reminders: EventReminder[];
  preferredSendTime?: string;  // HH:mm
  sendMode: 'draft' | 'auto';
  
  status: EventStatus;
  createdBy: string;
}

export interface EventReminder extends BaseEntity {
  eventId: string;
  triggerAt: string;     // ISO datetime when to trigger
  offsetMinutes: number; // e.g., -1440 for 24h before
  status: ReminderStatus;
  draftId?: string;
  sentAt?: string;
}

// ============================================================================
// DRAFT MESSAGE
// ============================================================================

export interface DraftMessage extends BaseEntity {
  // Target
  targetType: 'contact' | 'group';
  targetJid: string;
  targetName: string;
  targetPhone?: string;
  
  // Content
  message: string;
  templateId?: string;
  variables?: Record<string, string>;
  
  // Source
  source: DraftSource;
  sourceId?: string;  // eventId, ruleId, etc.
  
  // Status
  status: DraftStatus;
  approvedBy?: string;
  approvedAt?: string;
  sentAt?: string;
  messageId?: string;  // WhatsApp message ID after send
  error?: string;
  
  // Audit
  createdBy: string;
}

// ============================================================================
// TICKET
// ============================================================================

export interface Ticket extends BaseEntity {
  chatJid: string;
  messageId: string;
  messageText: string;
  contactName?: string;
  priority: TicketPriority;
  
  // AI Analysis
  aiSuggestion?: string;
  aiConfidence?: number;
  aiCategories?: string[];
  
  // Resolution
  status: TicketStatus;
  assignedTo?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolution?: TicketResolution;
  responseMessageId?: string;
}

// ============================================================================
// EVENT LOG (Audit Trail)
// ============================================================================

export interface EventLogEntry extends BaseEntity {
  type: EventLogType;
  level: 'info' | 'warning' | 'error';
  message: string;
  
  // Context
  entityType?: string;
  entityId?: string;
  actorId?: string;
  actorType?: 'system' | 'user' | 'bot';
  
  // Details
  data?: Record<string, any>;
  error?: string;
  
  timestamp: string;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface MarkAttendanceRequest {
  sessionId: string;
  records: Array<{
    studentId: string;
    status: AttendanceStatus;
    note?: string;
  }>;
}

export interface CreateEventRequest {
  title: string;
  type: EventType;
  date: string;
  startTime: string;
  endTime?: string;
  location?: string;
  description?: string;
  targetPrograms?: Program[];
  targetClassGroupIds?: string[];
  targetWaGroupJids?: string[];
  targetContactIds?: string[];
  enableReminders?: boolean;
  templateId?: string;
  reminderOffsets?: number[];  // Minutes before event
  preferredSendTime?: string;
  sendMode?: 'draft' | 'auto';
}

export interface CreateStudentRequest {
  firstName: string;
  lastName: string;
  program: Program;
  instrument?: string;
  level: string;
  birthDate?: string;
  notes?: string;
  tags?: string[];
  contacts: Array<{
    firstName: string;
    lastName: string;
    phone: string;
    relationship: string;
    isPrimary?: boolean;
  }>;
}

export interface CreateClassGroupRequest {
  name: string;
  program: Program;
  level: string;
  teacherId: string;
  room?: string;
  capacity?: number;
  schedules: Schedule[];
  waGroupJid?: string;
  botEnabled?: boolean;
}

export interface DashboardSummary {
  stats: {
    totalStudents: number;
    activeStudents: number;
    totalClasses: number;
    totalTeachers: number;
    pendingDrafts: number;
    pendingTickets: number;
    todayAttendance: {
      present: number;
      absent: number;
      late: number;
    };
  };
  upcomingEvents: Event[];
  recentActivity: EventLogEntry[];
  alerts: Ticket[];
}
