/**
 * Firestore Services - Central Export
 * All services for direct Firebase connection
 */

// Base service for extending
export { FirestoreService, type FirestoreDocument } from './baseService';

// Student service
export { alumnosService, type Alumno } from './alumnosService';

// Teacher services (both PROFESORES and MAESTROS collections)
export { profesoresService, type Profesor } from './profesoresService';
export { maestrosService, type Maestro, type MaestroInstrument, type MaestroSchedule } from './maestrosService';

// Class services
export { clasesService, type Clase, type ScheduleSlot, type ConflictResult, type ChangeHistoryEntry } from './clasesService';
export { emergencyClassesService, type EmergencyClass } from './emergencyClassesService';

// Rooms service
export { salonesService, type Salon } from './salonesService';

// Attendance service
export { asistenciasService, type Asistencia } from './asistenciasService';

// Schedule service
export { horariosService, type Horario } from './horariosService';

// Observations service
export { observacionesService, type Observacion } from './observacionesService';

// Contacts service
export { contactosService, type Contacto } from './contactosService';

// Broadcast service
export { broadcastsService, type Broadcast } from './broadcastsService';

// Templates service
export { templatesService, type Template } from './templatesService';

// Knowledge base service
export { knowledgeService, type KnowledgeEntry } from './knowledgeService';

// Tickets service
export { ticketsService, type Ticket } from './ticketsService';

// Utility services
export { referenceResolver, type EnrichedClase, type EnrichedAlumno, type EnrichedMaestro } from './referenceResolver';
export { dataValidator, type IntegrityReport, type OrphanedReference } from './dataValidator';
