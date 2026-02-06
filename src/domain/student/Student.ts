/**
 * @fileoverview Student Domain Entity - SEED INTERFACE
 * 
 * ⚠️ DOMAIN SEED - DO NOT IMPLEMENT YET
 * 
 * This interface is a structural placeholder for future implementation phases.
 * It defines the shape of a Student entity in the educational domain.
 * 
 * Roadmap Phase: B (Broadcast + Groups)
 * Current Status: SEED (interface only, no logic)
 * 
 * Implementation Notes:
 * - This interface will be used when the system manages student enrollment
 * - No business logic should be added until Phase B is active
 * - Related entities: Representative, Group, AttendanceRecord
 * 
 * @see /docs/vision/VISION_TO_ROADMAP.md for phase mapping
 */

/**
 * Represents a student enrolled in the institution.
 * 
 * @interface Student
 * @description Domain entity for student management (future implementation)
 */
export interface Student {
  /** Unique identifier for the student */
  id: string;

  /** Student's first name */
  firstName: string;

  /** Student's last name */
  lastName: string;

  /** Optional email address */
  email?: string;

  /** WhatsApp JID if the student has their own WhatsApp */
  whatsappJid?: string;

  /** Date of birth (ISO 8601 format) */
  dateOfBirth?: string;

  /** IDs of groups/ensembles the student belongs to */
  groupIds: string[];

  /** IDs of representatives (parents/guardians) linked to this student */
  representativeIds: string[];

  /** Enrollment status */
  status: StudentStatus;

  /** Date when the student was enrolled (ISO 8601 format) */
  enrolledAt: string;

  /** Date of last update (ISO 8601 format) */
  updatedAt: string;

  /** Optional notes or observations */
  notes?: string;
}

/**
 * Possible enrollment statuses for a student.
 */
export type StudentStatus = 
  | 'active'      // Currently enrolled and participating
  | 'inactive'    // Temporarily not participating
  | 'graduated'   // Completed the program
  | 'withdrawn';  // Left the institution

/**
 * Minimal student reference for list views and relations.
 */
export interface StudentSummary {
  id: string;
  firstName: string;
  lastName: string;
  status: StudentStatus;
}
