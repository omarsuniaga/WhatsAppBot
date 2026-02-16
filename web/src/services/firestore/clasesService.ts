/**
 * Clases Service
 * Manages CLASES collection in Firestore
 * Professional schema with conflict detection and collaboration
 */

import { where, QueryConstraint } from 'firebase/firestore';
import { FirestoreService, FirestoreDocument } from './baseService';
import { dataValidator } from './dataValidator';

// Schedule slot for a class session
export interface ScheduleSlot {
    day: string;        // 'Lunes', 'Martes', etc.
    startTime: string;  // '08:00'
    endTime: string;    // '09:30'
}

// Change history entry for audit trail
export interface ChangeHistoryEntry {
    timestamp: string;
    changes: string;
    userId?: string;
}

// Conflict detection result
export interface ConflictResult {
    type: 'room' | 'teacher' | 'student';
    conflictingClassId: string;
    conflictingClassName: string;
    day: string;
    time: string;
    details: string;
}

// Main Clase interface matching Firestore CLASES collection
// Includes BOTH new fields AND legacy Spanish fields for backward compatibility
export interface Clase extends FirestoreDocument {
    // Basic info (new)
    name?: string;
    description?: string;
    instrument?: string;        // Legacy: single instrument (deprecated, use instruments)
    instruments?: string[];     // NEW: support multiple instruments for combined classes

    // Basic info (legacy)
    nombre?: string;
    instrumento?: string;
    descripcion?: string;

    // Status
    status?: 'active' | 'inactive' | 'archived';
    activo?: boolean; // legacy

    // Teacher Assignment (supports single or multiple teachers)
    teacherId?: string | string[];  // UID(s) from MAESTROS collection

    // Primary Teacher (legacy)
    profesor_id?: string;
    profesor_nombre?: string;
    profesor_ids?: string[];
    profesor_nombres?: string[];

    // Collaboration - shared with other teachers
    sharedWith?: string[];
    permissions?: Record<string, string[]>;

    // Students (new)
    studentIds?: string[];

    // Students (legacy)
    alumno_ids?: string[];
    alumnos?: string[];

    // Room (new)
    roomId?: string;

    // Room (legacy)
    salon_id?: string;
    salon_nombre?: string;

    // Schedule (new format)
    schedule?: {
        slots: ScheduleSlot[];
    };

    // Schedule (legacy format)
    horarios?: Array<{
        dia: number;
        hora_inicio: string;
        hora_fin: string;
    }>;
    dia?: string;
    dias?: string[];
    hora_inicio?: string;
    hora_fin?: string;

    // Audit trail
    changeHistory?: ChangeHistoryEntry[];

    // Metadata
    createdAt?: string;
    updatedAt?: string;
}

/**
 * Helper Functions for Multi-Teacher Support
 */

/**
 * Get all teacher UIDs from a class (handles both string and array)
 * Also checks legacy fields for backward compatibility
 */
export const getTeacherIds = (clase: Partial<Clase>): string[] => {
    if (!clase.teacherId) {
        // Fallback to legacy fields
        if (clase.profesor_ids && clase.profesor_ids.length > 0) {
            return clase.profesor_ids;
        }
        if (clase.profesor_id) {
            return [clase.profesor_id];
        }
        // Check sharedWith for legacy collaboration
        if (clase.sharedWith && clase.sharedWith.length > 0) {
            return clase.sharedWith;
        }
        return [];
    }

    return Array.isArray(clase.teacherId) ? clase.teacherId : [clase.teacherId];
};

/**
 * Check if a teacher is assigned to a class
 */
export const isTeacherAssigned = (clase: Partial<Clase>, teacherUid: string): boolean => {
    const teacherIds = getTeacherIds(clase);
    return teacherIds.includes(teacherUid);
};

/**
 * Add a teacher to a class
 * Returns the updated teacherId value (string if single, array if multiple)
 */
export const addTeacherToClass = (clase: Partial<Clase>, teacherUid: string): string | string[] => {
    const current = getTeacherIds(clase);

    if (current.includes(teacherUid)) {
        // Already assigned, return current value
        return clase.teacherId || (current.length === 1 ? current[0] : current);
    }

    const updated = [...current, teacherUid];
    return updated.length === 1 ? updated[0] : updated;
};

/**
 * Remove a teacher from a class
 * Returns the updated teacherId value (string if single, array if multiple, undefined if none)
 */
export const removeTeacherFromClass = (clase: Partial<Clase>, teacherUid: string): string | string[] | undefined => {
    const current = getTeacherIds(clase);
    const updated = current.filter(id => id !== teacherUid);

    if (updated.length === 0) return undefined;
    return updated.length === 1 ? updated[0] : updated;
};

/**
 * Get the primary teacher UID (first in the list)
 */
export const getPrimaryTeacherId = (clase: Partial<Clase>): string | undefined => {
    const teacherIds = getTeacherIds(clase);
    return teacherIds.length > 0 ? teacherIds[0] : undefined;
};

/**
 * Check if a class has multiple teachers
 */
export const hasMultipleTeachers = (clase: Partial<Clase>): boolean => {
    return getTeacherIds(clase).length > 1;
};

// Helper to check if two time slots overlap
const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

const slotsOverlap = (slot1: ScheduleSlot, slot2: ScheduleSlot): boolean => {
    if (slot1.day !== slot2.day) return false;

    const start1 = timeToMinutes(slot1.startTime);
    const end1 = timeToMinutes(slot1.endTime);
    const start2 = timeToMinutes(slot2.startTime);
    const end2 = timeToMinutes(slot2.endTime);

    return start1 < end2 && start2 < end1;
};

class ClasesServiceClass extends FirestoreService<Clase> {
    constructor() {
        super('CLASES');
    }

    async getAllClases(activeOnly: boolean = false): Promise<Clase[]> {
        const constraints: QueryConstraint[] = [];

        if (activeOnly) {
            constraints.push(where('status', '==', 'active'));
        }

        return super.getAll(constraints);
    }

    async getByTeacher(teacherId: string): Promise<Clase[]> {
        // Get classes where teacher is assigned (primary or co-teacher)
        const allClasses = await this.getAllClases();
        return allClasses.filter(c => isTeacherAssigned(c, teacherId));
    }

    async getByRoom(roomId: string): Promise<Clase[]> {
        return this.query('roomId', '==', roomId);
    }

    async getByStudent(studentId: string): Promise<Clase[]> {
        const allClasses = await this.getAllClases();
        return allClasses.filter(c => c.studentIds?.includes(studentId));
    }

    async getActiveClasses(): Promise<Clase[]> {
        return this.getAllClases(true);
    }

    /**
     * Detect scheduling conflicts for a class
     * Checks: room conflicts, teacher conflicts, student conflicts
     */
    async detectConflicts(
        newClass: Partial<Clase>,
        excludeClassId?: string
    ): Promise<ConflictResult[]> {
        const conflicts: ConflictResult[] = [];
        const allClasses = await this.getAllClases(true);

        if (!newClass.schedule?.slots || newClass.schedule.slots.length === 0) {
            return conflicts;
        }

        for (const existing of allClasses) {
            // Skip self
            if (excludeClassId && existing.id === excludeClassId) continue;
            if (!existing.schedule?.slots) continue;

            for (const newSlot of newClass.schedule.slots) {
                for (const existingSlot of existing.schedule.slots) {
                    if (!slotsOverlap(newSlot, existingSlot)) continue;

                    const timeStr = `${newSlot.startTime} - ${newSlot.endTime}`;
                    const existingName = existing.name || existing.nombre || 'Sin nombre';
                    const existingStudentIds = existing.studentIds || existing.alumno_ids || [];

                    // Room conflict
                    if (newClass.roomId && newClass.roomId === existing.roomId) {
                        conflicts.push({
                            type: 'room',
                            conflictingClassId: existing.id,
                            conflictingClassName: existingName,
                            day: newSlot.day,
                            time: timeStr,
                            details: `El salón ya está ocupado por "${existingName}"`
                        });
                    }

                    // Teacher conflict (check both new and legacy fields)
                    const newTeacherId = newClass.teacherId || newClass.profesor_id;
                    const existingTeacherId = existing.teacherId || existing.profesor_id;
                    if (newTeacherId && newTeacherId === existingTeacherId) {
                        conflicts.push({
                            type: 'teacher',
                            conflictingClassId: existing.id,
                            conflictingClassName: existingName,
                            day: newSlot.day,
                            time: timeStr,
                            details: `El maestro ya tiene clase "${existingName}"`
                        });
                    }

                    // Student conflicts (check both new and legacy fields)
                    const newStudentIds = newClass.studentIds || newClass.alumno_ids || [];
                    if (newStudentIds.length > 0 && existingStudentIds.length > 0) {
                        const sharedStudents = newStudentIds.filter(
                            id => existingStudentIds.includes(id)
                        );
                        if (sharedStudents.length > 0) {
                            conflicts.push({
                                type: 'student',
                                conflictingClassId: existing.id,
                                conflictingClassName: existingName,
                                day: newSlot.day,
                                time: timeStr,
                                details: `${sharedStudents.length} alumno(s) ya están en "${existingName}"`
                            });
                        }
                    }
                }
            }
        }

        return conflicts;
    }

    /**
     * Create class with automatic change history and validation
     */
    async createWithHistory(clase: Omit<Clase, 'id'>, userId?: string): Promise<string> {
        // Validate references before creating
        const validation = await dataValidator.validateClase(clase);
        if (!validation.valid) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        const now = new Date().toISOString();
        const classWithHistory: Omit<Clase, 'id'> = {
            ...clase,
            createdAt: now,
            updatedAt: now,
            changeHistory: [{
                timestamp: now,
                changes: 'Clase creada',
                userId
            }]
        };
        return super.create(classWithHistory);
    }

    /**
     * Update class with automatic change history and validation
     */
    async updateWithHistory(
        id: string,
        updates: Partial<Clase>,
        changeDescription: string,
        userId?: string
    ): Promise<void> {
        const existing = await this.getById(id);
        if (!existing) throw new Error('Clase no encontrada');

        // Validate merged state
        const merged = { ...existing, ...updates };
        const validation = await dataValidator.validateClase(merged);
        if (!validation.valid) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        const now = new Date().toISOString();
        const history = existing.changeHistory || [];
        history.push({
            timestamp: now,
            changes: changeDescription,
            userId
        });

        await super.update(id, {
            ...updates,
            updatedAt: now,
            changeHistory: history
        });
    }

    /**
     * Get weekly schedule across all classes
     * Returns classes grouped by day with time slots
     */
    async getWeeklySchedule(): Promise<Record<string, Clase[]>> {
        const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        const schedule: Record<string, Clase[]> = {};

        const allClasses = await this.getActiveClasses();

        days.forEach(day => {
            schedule[day] = allClasses.filter(clase => {
                const slots = clase.schedule?.slots || [];
                return slots.some(slot => slot.day === day);
            }).sort((a, b) => {
                // Sort by earliest start time
                const aSlots = a.schedule?.slots?.filter(s => s.day === day) || [];
                const bSlots = b.schedule?.slots?.filter(s => s.day === day) || [];
                const aStart = aSlots[0]?.startTime || '00:00';
                const bStart = bSlots[0]?.startTime || '00:00';
                return aStart.localeCompare(bStart);
            });
        });

        return schedule;
    }

    /**
     * Bulk assign classes to a teacher
     * Useful when linking legacy classes to a new teacher account
     */
    async assignTeacherToClasses(classIds: string[], teacherId: string, teacherName: string): Promise<void> {
        try {
            const promises = classIds.map(id =>
                this.update(id, {
                    teacherId: teacherId,
                    profesor_id: teacherId, // Legacy sync
                    profesor_nombre: teacherName, // Legacy sync
                    // Update collaboration permissions if needed
                    permissions: {
                        [teacherId]: ['edit', 'attendance', 'grading']
                    }
                })
            );
            await Promise.all(promises);
        } catch (error) {
            console.error('Error batch assigning classes:', error);
            throw error;
        }
    }

    /**
     * Get classes scheduled for a specific day
     * @param dayName - Full day name (Lunes, Martes, etc.)
     */
    async getClassesByDay(dayName: string): Promise<Clase[]> {
        const allClasses = await this.getActiveClasses();

        return allClasses.filter(clase => {
            // Check modern schedule
            if (clase.schedule?.slots?.some(s => s.day === dayName)) {
                return true;
            }

            // Check legacy 'dia' string
            if (clase.dia === dayName) return true;

            // Check legacy 'dias' array
            if (clase.dias?.includes(dayName)) return true;

            return false;
        });
    }
}

export const clasesService = new ClasesServiceClass();
