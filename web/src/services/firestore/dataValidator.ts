/**
 * Data Validator Utility
 * Validates referential integrity and generates integrity reports
 */

import { clasesService, type Clase } from './clasesService';
import { maestrosService } from './maestrosService';
import { salonesService } from './salonesService';
import { alumnosService } from './alumnosService';

export interface OrphanedReference {
    entityType: 'clase' | 'alumno';
    entityId: string;
    entityName?: string;
    referenceType: 'teacher' | 'room' | 'student' | 'class';
    invalidId: string;
}

export interface IntegrityReport {
    timestamp: string;
    orphanedReferences: OrphanedReference[];
    missingSchedules: string[];
    inconsistentBidirectional: Array<{
        alumnoId: string;
        claseId: string;
        issue: string;
    }>;
    duplicateStudents: Array<{
        student1Id: string;
        student2Id: string;
        reason: string;
    }>;
    summary: {
        totalClases: number;
        totalMaestros: number;
        totalSalones: number;
        totalAlumnos: number;
        issuesFound: number;
    };
}

/**
 * Data Validator Service
 */
export class DataValidatorClass {
    /**
     * Validate that a teacher ID exists
     */
    async validateTeacherExists(teacherId: string): Promise<boolean> {
        const teacher = await maestrosService.getById(teacherId);
        return !!teacher;
    }

    /**
     * Validate that a room ID exists
     */
    async validateRoomExists(roomId: string): Promise<boolean> {
        const room = await salonesService.getById(roomId);
        return !!room;
    }

    /**
     * Validate that all student IDs exist
     */
    async validateStudentsExist(studentIds: string[]): Promise<boolean> {
        if (!studentIds || studentIds.length === 0) return true;

        const validations = await Promise.all(
            studentIds.map(id => alumnosService.getById(id))
        );

        return validations.every(student => !!student);
    }

    /**
     * Validate that a class ID exists
     */
    async validateClassExists(classId: string): Promise<boolean> {
        const clase = await clasesService.getById(classId);
        return !!clase;
    }

    /**
     * Validate a Clase before creation/update
     */
    async validateClase(clase: Partial<Clase>): Promise<{
        valid: boolean;
        errors: string[];
    }> {
        const errors: string[] = [];

        // Validate teacher
        const teacherId = clase.teacherId || clase.profesor_id;
        if (teacherId) {
            const teacherExists = await this.validateTeacherExists(teacherId);
            if (!teacherExists) {
                errors.push(`Profesor con ID ${teacherId} no existe`);
            }
        }

        // Validate room
        const roomId = clase.roomId || clase.salon_id;
        if (roomId) {
            const roomExists = await this.validateRoomExists(roomId);
            if (!roomExists) {
                errors.push(`Salón con ID ${roomId} no existe`);
            }
        }

        // Validate students
        const studentIds = clase.studentIds || clase.alumno_ids || [];
        if (studentIds.length > 0) {
            for (const id of studentIds) {
                const exists = await alumnosService.getById(id);
                if (!exists) {
                    errors.push(`Alumno con ID ${id} no existe`);
                }
            }
        }

        // Validate schedule
        if (!clase.schedule?.slots || clase.schedule.slots.length === 0) {
            errors.push('Clase debe tener al menos un horario definido');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Generate a comprehensive integrity report
     */
    async generateIntegrityReport(): Promise<IntegrityReport> {
        const report: IntegrityReport = {
            timestamp: new Date().toISOString(),
            orphanedReferences: [],
            missingSchedules: [],
            inconsistentBidirectional: [],
            duplicateStudents: [],
            summary: {
                totalClases: 0,
                totalMaestros: 0,
                totalSalones: 0,
                totalAlumnos: 0,
                issuesFound: 0
            }
        };

        // Fetch all data
        const [clases, maestros, salones, alumnos] = await Promise.all([
            clasesService.getAllClases(),
            maestrosService.getAllMaestros(),
            salonesService.getAllSalones(),
            alumnosService.getAll()
        ]);

        report.summary.totalClases = clases.length;
        report.summary.totalMaestros = maestros.length;
        report.summary.totalSalones = salones.length;
        report.summary.totalAlumnos = alumnos.length;

        // Create ID sets for fast lookup
        const maestroIds = new Set(maestros.map(m => m.id));
        const salonIds = new Set(salones.map(s => s.id));
        const alumnoIds = new Set(alumnos.map(a => a.id));
        const claseIds = new Set(clases.map(c => c.id));

        // Check orphaned teacher references in CLASES
        clases.forEach(clase => {
            const teacherId = clase.teacherId || clase.profesor_id;
            if (teacherId && !maestroIds.has(teacherId)) {
                report.orphanedReferences.push({
                    entityType: 'clase',
                    entityId: clase.id,
                    entityName: clase.name || clase.nombre,
                    referenceType: 'teacher',
                    invalidId: teacherId
                });
            }

            // Check orphaned room references
            const roomId = clase.roomId || clase.salon_id;
            if (roomId && !salonIds.has(roomId)) {
                report.orphanedReferences.push({
                    entityType: 'clase',
                    entityId: clase.id,
                    entityName: clase.name || clase.nombre,
                    referenceType: 'room',
                    invalidId: roomId
                });
            }

            // Check orphaned student references
            const studentIds = clase.studentIds || clase.alumno_ids || [];
            studentIds.forEach(studentId => {
                if (!alumnoIds.has(studentId)) {
                    report.orphanedReferences.push({
                        entityType: 'clase',
                        entityId: clase.id,
                        entityName: clase.name || clase.nombre,
                        referenceType: 'student',
                        invalidId: studentId
                    });
                }
            });

            // Check missing schedules
            if (!clase.schedule?.slots || clase.schedule.slots.length === 0) {
                if (!clase.horarios || clase.horarios.length === 0) {
                    report.missingSchedules.push(clase.id);
                }
            }
        });

        // Check orphaned class references in ALUMNOS
        alumnos.forEach(alumno => {
            if (alumno.classIds?.length) {
                alumno.classIds.forEach(classId => {
                    if (!claseIds.has(classId)) {
                        report.orphanedReferences.push({
                            entityType: 'alumno',
                            entityId: alumno.id,
                            entityName: `${alumno.nombre} ${alumno.apellido}`,
                            referenceType: 'class',
                            invalidId: classId
                        });
                    }
                });
            }
        });

        // Check bidirectional consistency: Alumno.classIds <-> Clase.studentIds
        alumnos.forEach(alumno => {
            if (alumno.classIds?.length) {
                alumno.classIds.forEach(classId => {
                    const clase = clases.find(c => c.id === classId);
                    if (clase) {
                        const studentIds = clase.studentIds || clase.alumno_ids || [];
                        if (!studentIds.includes(alumno.id)) {
                            report.inconsistentBidirectional.push({
                                alumnoId: alumno.id,
                                claseId: classId,
                                issue: `Alumno referencia clase pero clase no incluye alumno`
                            });
                        }
                    }
                });
            }
        });

        // Check for duplicate students (same cedula or same nombre+apellido)
        const seenByCedula = new Map<string, string>();
        const seenByName = new Map<string, string>();

        alumnos.forEach(alumno => {
            // Check cedula duplicates
            if (alumno.cedula) {
                const existing = seenByCedula.get(alumno.cedula);
                if (existing) {
                    report.duplicateStudents.push({
                        student1Id: existing,
                        student2Id: alumno.id,
                        reason: `Misma cédula: ${alumno.cedula}`
                    });
                } else {
                    seenByCedula.set(alumno.cedula, alumno.id);
                }
            }

            // Check name duplicates (less strict, just flag for review)
            const nameKey = `${alumno.nombre?.toLowerCase()}-${alumno.apellido?.toLowerCase()}`;
            const existingName = seenByName.get(nameKey);
            if (existingName && alumno.nombre && alumno.apellido) {
                // Only report if both have same phone (higher confidence)
                const existing = alumnos.find(a => a.id === existingName);
                if (existing?.tlf && existing.tlf === alumno.tlf) {
                    report.duplicateStudents.push({
                        student1Id: existingName,
                        student2Id: alumno.id,
                        reason: `Mismo nombre y teléfono`
                    });
                }
            } else {
                seenByName.set(nameKey, alumno.id);
            }
        });

        // Calculate total issues
        report.summary.issuesFound = 
            report.orphanedReferences.length +
            report.missingSchedules.length +
            report.inconsistentBidirectional.length +
            report.duplicateStudents.length;

        return report;
    }

    /**
     * Print integrity report to console
     */
    printIntegrityReport(report: IntegrityReport): void {
        console.log('='.repeat(60));
        console.log('INTEGRITY REPORT');
        console.log('='.repeat(60));
        console.log(`Generated: ${report.timestamp}`);
        console.log('');
        console.log('Summary:');
        console.log(`  Total Clases: ${report.summary.totalClases}`);
        console.log(`  Total Maestros: ${report.summary.totalMaestros}`);
        console.log(`  Total Salones: ${report.summary.totalSalones}`);
        console.log(`  Total Alumnos: ${report.summary.totalAlumnos}`);
        console.log(`  Issues Found: ${report.summary.issuesFound}`);
        console.log('');

        if (report.orphanedReferences.length > 0) {
            console.log('Orphaned References:');
            report.orphanedReferences.forEach(ref => {
                console.log(`  - ${ref.entityType} ${ref.entityId} has invalid ${ref.referenceType} ID: ${ref.invalidId}`);
            });
            console.log('');
        }

        if (report.missingSchedules.length > 0) {
            console.log('Missing Schedules:');
            report.missingSchedules.forEach(id => {
                console.log(`  - Clase ${id} has no schedule`);
            });
            console.log('');
        }

        if (report.inconsistentBidirectional.length > 0) {
            console.log('Inconsistent Bidirectional References:');
            report.inconsistentBidirectional.forEach(issue => {
                console.log(`  - ${issue.issue} (Alumno: ${issue.alumnoId}, Clase: ${issue.claseId})`);
            });
            console.log('');
        }

        if (report.duplicateStudents.length > 0) {
            console.log('Potential Duplicate Students:');
            report.duplicateStudents.forEach(dup => {
                console.log(`  - ${dup.student1Id} and ${dup.student2Id}: ${dup.reason}`);
            });
            console.log('');
        }

        console.log('='.repeat(60));
    }
}

export const dataValidator = new DataValidatorClass();
