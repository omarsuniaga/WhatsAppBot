/**
 * @fileoverview Attendance Record Domain Entity - SEED INTERFACE
 * 
 * ⚠️ DOMAIN SEED - DO NOT IMPLEMENT YET
 * 
 * This interface is a structural placeholder for future implementation phases.
 * It defines the shape of attendance tracking records.
 * 
 * Roadmap Phase: C (IA con Barandillas)
 * Current Status: NO EXISTE (interface only, no logic)
 * 
 * Implementation Notes:
 * - Attendance records link students, groups, and specific dates
 * - They enable future automated notifications for absences
 * - No business logic should be added until Phase C is active
 * - Related entities: Student, Group
 * - Depends on: Student and Group entities being implemented first
 * 
 * @see /docs/vision/VISION_TO_ROADMAP.md for phase mapping
 */

/**
 * Represents an attendance record for a student in a specific session.
 * 
 * @interface AttendanceRecord
 * @description Domain entity for attendance tracking (future implementation)
 */
export interface AttendanceRecord {
  /** Unique identifier for the attendance record */
  id: string;

  /** ID of the student */
  studentId: string;

  /** ID of the group/class */
  groupId: string;

  /** Date of the session (ISO 8601 date format: YYYY-MM-DD) */
  date: string;

  /** Attendance status */
  status: AttendanceStatus;

  /** Time when attendance was recorded (ISO 8601 format) */
  recordedAt: string;

  /** Who recorded the attendance (instructor ID or system) */
  recordedBy: string;

  /** Optional notes (e.g., reason for absence) */
  notes?: string;

  /** Whether the representative was notified (for absences) */
  representativeNotified?: boolean;

  /** When the representative was notified (ISO 8601 format) */
  notifiedAt?: string;
}

/**
 * Possible attendance statuses.
 */
export type AttendanceStatus =
  | 'present'       // Student attended
  | 'absent'        // Student did not attend (unexcused)
  | 'excused'       // Absence was excused
  | 'late'          // Student arrived late
  | 'early_leave';  // Student left early

/**
 * Summary of attendance for a student over a period.
 * Used for reports and analytics (Phase D+).
 */
export interface AttendanceSummary {
  studentId: string;
  groupId: string;

  /** Total sessions in the period */
  totalSessions: number;

  /** Count by status */
  present: number;
  absent: number;
  excused: number;
  late: number;

  /** Attendance percentage */
  attendanceRate: number;

  /** Period covered (ISO 8601 dates) */
  periodStart: string;
  periodEnd: string;
}

/**
 * Bulk attendance input for a session.
 * Used when recording attendance for an entire group at once.
 */
export interface SessionAttendanceInput {
  groupId: string;
  date: string;
  records: Array<{
    studentId: string;
    status: AttendanceStatus;
    notes?: string;
  }>;
  recordedBy: string;
}
