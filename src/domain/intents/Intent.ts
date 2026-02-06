/**
 * @fileoverview Intent Classification - SEED INTERFACE
 * 
 * ⚠️ DOMAIN SEED - PARTIAL IMPLEMENTATION
 * 
 * This file defines the base intents for classifying user messages.
 * Intent classification helps route messages to appropriate handlers
 * and improves AI response accuracy.
 * 
 * Roadmap Phase: B (Classification), currently SEMILLA in Phase A
 * Current Status: SEED (types defined, classification logic TBD)
 * 
 * Implementation Notes:
 * - Base intents are defined here for future classification system
 * - Currently, BotOrchestrator uses keyword-based matching
 * - Full intent classification will use ML/AI in Phase B
 * - These intents align with Knowledge Base categories
 * 
 * @see /docs/vision/VISION_TO_ROADMAP.md for phase mapping
 * @see /src/agents/BotOrchestrator.ts for current implementation
 */

/**
 * Base intent types for message classification.
 * 
 * These represent the primary categories of user inquiries
 * that the system should be able to recognize and handle.
 */
export type BaseIntent =
  | 'HORARIO'       // Schedule-related questions (classes, events, hours)
  | 'INSCRIPCION'   // Enrollment and registration inquiries
  | 'ASISTENCIA'    // Attendance-related questions
  | 'PAGO'          // Payment and fees inquiries
  | 'GENERAL';      // General information, fallback category

/**
 * Extended intent for more granular classification (Phase C+).
 */
export type ExtendedIntent =
  | BaseIntent
  | 'EVENTO'        // Specific event inquiries
  | 'UBICACION'     // Location and directions
  | 'CONTACTO'      // Contact information requests
  | 'QUEJA'         // Complaints or issues
  | 'FELICITACION'  // Positive feedback
  | 'OTRO';         // Unclassified

/**
 * Result of intent classification.
 */
export interface IntentClassification {
  /** Primary detected intent */
  intent: BaseIntent | ExtendedIntent;

  /** Confidence score (0.0 to 1.0) */
  confidence: number;

  /** Alternative intents with lower confidence */
  alternatives?: Array<{
    intent: BaseIntent | ExtendedIntent;
    confidence: number;
  }>;

  /** Extracted entities from the message */
  entities?: ExtractedEntities;

  /** Original message that was classified */
  originalMessage: string;

  /** Timestamp of classification (ISO 8601 format) */
  classifiedAt: string;
}

/**
 * Entities extracted from a user message.
 * Used for contextual understanding (Phase C+).
 */
export interface ExtractedEntities {
  /** Detected dates or times */
  datetime?: string[];

  /** Detected names (students, groups) */
  names?: string[];

  /** Detected monetary amounts */
  amounts?: string[];

  /** Detected group/class references */
  groupReferences?: string[];

  /** Raw entity spans with positions */
  spans?: Array<{
    text: string;
    type: string;
    start: number;
    end: number;
  }>;
}

/**
 * Mapping of intents to Knowledge Base categories.
 * Used to route classified intents to appropriate KB searches.
 */
export const INTENT_TO_KB_CATEGORY: Record<BaseIntent, string[]> = {
  HORARIO: ['horarios', 'schedule', 'clases'],
  INSCRIPCION: ['inscripcion', 'enrollment', 'registro'],
  ASISTENCIA: ['asistencia', 'attendance'],
  PAGO: ['pagos', 'payment', 'costos', 'precios'],
  GENERAL: ['general', 'info', 'about'],
};

/**
 * Human-readable labels for intents (Spanish).
 */
export const INTENT_LABELS: Record<BaseIntent, string> = {
  HORARIO: 'Consulta de Horarios',
  INSCRIPCION: 'Inscripción / Registro',
  ASISTENCIA: 'Asistencia',
  PAGO: 'Pagos y Costos',
  GENERAL: 'Información General',
};

/**
 * Example phrases for each intent (used for training/reference).
 * 
 * NOTE: These are examples only. Actual classification should use
 * ML models or fuzzy matching, not exact string comparison.
 */
export const INTENT_EXAMPLES: Record<BaseIntent, string[]> = {
  HORARIO: [
    '¿Cuál es el horario de clases?',
    '¿A qué hora es el ensayo?',
    '¿Qué días hay clase?',
    'Horario de la orquesta',
  ],
  INSCRIPCION: [
    '¿Cómo inscribo a mi hijo?',
    'Quiero inscribirme',
    '¿Cuáles son los requisitos?',
    'Proceso de inscripción',
  ],
  ASISTENCIA: [
    'Mi hijo no puede ir hoy',
    '¿Cómo justifico una falta?',
    'Ausencia por enfermedad',
    'No podrá asistir',
  ],
  PAGO: [
    '¿Cuánto cuesta la inscripción?',
    '¿Cómo puedo pagar?',
    'Métodos de pago',
    '¿Tienen plan de pagos?',
  ],
  GENERAL: [
    '¿Dónde están ubicados?',
    'Información general',
    'Hola, buenas tardes',
    '¿Qué instrumentos enseñan?',
  ],
};
