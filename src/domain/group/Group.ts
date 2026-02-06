/**
 * @fileoverview Group Domain Entity - SEED INTERFACE
 * 
 * ⚠️ DOMAIN SEED - DO NOT IMPLEMENT YET
 * 
 * This interface is a structural placeholder for future implementation phases.
 * It defines the shape of a Group (ensemble, class, or organizational unit).
 * 
 * Roadmap Phase: B (Broadcast + Groups)
 * Current Status: SEED (interface only, no logic)
 * 
 * Implementation Notes:
 * - Groups represent organizational units like orchestras, choirs, classes
 * - They are used for targeted communication and attendance tracking
 * - No business logic should be added until Phase B is active
 * - Related entities: Student, AttendanceRecord
 * 
 * @see /docs/vision/VISION_TO_ROADMAP.md for phase mapping
 */

/**
 * Represents an organizational group (orchestra, choir, class, etc.).
 * 
 * @interface Group
 * @description Domain entity for group/ensemble management (future implementation)
 */
export interface Group {
  /** Unique identifier for the group */
  id: string;

  /** Display name of the group */
  name: string;

  /** Short code for the group (e.g., "ORCH-A", "CHOIR-1") */
  code: string;

  /** Type/category of the group */
  type: GroupType;

  /** Optional description */
  description?: string;

  /** IDs of students enrolled in this group */
  studentIds: string[];

  /** ID of the instructor/director (future: linked to Staff entity) */
  instructorId?: string;

  /** Regular schedule for this group */
  schedule?: GroupSchedule;

  /** Whether the group is currently active */
  isActive: boolean;

  /** Maximum capacity (optional) */
  capacity?: number;

  /** Date when the group was created (ISO 8601 format) */
  createdAt: string;

  /** Date of last update (ISO 8601 format) */
  updatedAt: string;
}

/**
 * Types of groups in the institution.
 */
export type GroupType =
  | 'orchestra'       // Orquesta
  | 'choir'           // Coro
  | 'initiation'      // Iniciación musical
  | 'instrument'      // Clase de instrumento
  | 'theory'          // Teoría musical
  | 'ensemble'        // Ensamble
  | 'other';

/**
 * Schedule definition for a group.
 */
export interface GroupSchedule {
  /** Days of the week (0 = Sunday, 6 = Saturday) */
  daysOfWeek: number[];

  /** Start time (HH:MM format) */
  startTime: string;

  /** End time (HH:MM format) */
  endTime: string;

  /** Location/room */
  location?: string;

  /** Timezone (e.g., "America/Santo_Domingo") */
  timezone: string;
}

/**
 * Minimal group reference for list views and relations.
 */
export interface GroupSummary {
  id: string;
  name: string;
  code: string;
  type: GroupType;
  studentCount: number;
  isActive: boolean;
}
