/**
 * @fileoverview Representative Domain Entity - SEED INTERFACE
 * 
 * ⚠️ DOMAIN SEED - DO NOT IMPLEMENT YET
 * 
 * This interface is a structural placeholder for future implementation phases.
 * It defines the shape of a Representative (parent/guardian) entity.
 * 
 * Roadmap Phase: B (Broadcast + Groups)
 * Current Status: SEED (interface only, no logic)
 * 
 * Implementation Notes:
 * - Representatives are the primary contact for communication about students
 * - They receive notifications, alerts, and can interact with the bot
 * - No business logic should be added until Phase B is active
 * - Related entities: Student, Group
 * 
 * @see /docs/vision/VISION_TO_ROADMAP.md for phase mapping
 */

/**
 * Represents a parent, guardian, or authorized contact for students.
 * 
 * @interface Representative
 * @description Domain entity for representative/guardian management (future implementation)
 */
export interface Representative {
  /** Unique identifier for the representative */
  id: string;

  /** Representative's first name */
  firstName: string;

  /** Representative's last name */
  lastName: string;

  /** Primary WhatsApp JID - main communication channel */
  whatsappJid: string;

  /** Optional secondary phone number */
  secondaryPhone?: string;

  /** Optional email address */
  email?: string;

  /** Relationship to the student(s) */
  relationship: RepresentativeRelationship;

  /** IDs of students this representative is responsible for */
  studentIds: string[];

  /** Whether this representative can receive automated notifications */
  receiveNotifications: boolean;

  /** Preferred language for communication */
  preferredLanguage: 'es' | 'en';

  /** Date when the representative was registered (ISO 8601 format) */
  createdAt: string;

  /** Date of last update (ISO 8601 format) */
  updatedAt: string;

  /** Date of last interaction via WhatsApp (ISO 8601 format) */
  lastInteractionAt?: string;
}

/**
 * Possible relationships between a representative and a student.
 */
export type RepresentativeRelationship =
  | 'mother'
  | 'father'
  | 'guardian'
  | 'grandparent'
  | 'sibling'
  | 'other';

/**
 * Minimal representative reference for list views and relations.
 */
export interface RepresentativeSummary {
  id: string;
  firstName: string;
  lastName: string;
  whatsappJid: string;
  relationship: RepresentativeRelationship;
}

/**
 * Contact preferences for a representative.
 */
export interface ContactPreferences {
  /** Can receive general announcements */
  announcements: boolean;

  /** Can receive attendance alerts */
  attendanceAlerts: boolean;

  /** Can receive event reminders */
  eventReminders: boolean;

  /** Can receive payment reminders */
  paymentReminders: boolean;

  /** Preferred contact hours (e.g., "09:00-18:00") */
  preferredHours?: string;
}
