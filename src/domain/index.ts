/**
 * @fileoverview Domain Layer - Index
 * 
 * ⚠️ DOMAIN SEEDS - STRUCTURAL PLACEHOLDERS
 * 
 * This folder contains domain entity interfaces that are NOT YET IMPLEMENTED.
 * They serve as structural preparation for future phases of the roadmap.
 * 
 * Current Status:
 * - Student, Representative, Group: SEED (Phase B)
 * - AttendanceRecord: NO EXISTE (Phase C)
 * - Intent: SEED (Phase A/B)
 * 
 * DO NOT:
 * - Implement business logic in these files
 * - Connect these interfaces to existing services
 * - Use these in production code until their phase is active
 * 
 * @see /docs/vision/VISION_TO_ROADMAP.md for phase mapping
 */

// Student domain (Phase B)
export type {
  Student,
  StudentStatus,
  StudentSummary,
} from './student/Student';

// Representative domain (Phase B)
export type {
  Representative,
  RepresentativeRelationship,
  RepresentativeSummary,
  ContactPreferences,
} from './representative/Representative';

// Group domain (Phase B)
export type {
  Group,
  GroupType,
  GroupSchedule,
  GroupSummary,
} from './group/Group';

// Attendance domain (Phase C)
export type {
  AttendanceRecord,
  AttendanceStatus,
  AttendanceSummary,
  SessionAttendanceInput,
} from './attendance/AttendanceRecord';

// Intent classification (Phase A/B)
export type {
  BaseIntent,
  ExtendedIntent,
  IntentClassification,
  ExtractedEntities,
} from './intents/Intent';

export {
  INTENT_TO_KB_CATEGORY,
  INTENT_LABELS,
  INTENT_EXAMPLES,
} from './intents/Intent';
