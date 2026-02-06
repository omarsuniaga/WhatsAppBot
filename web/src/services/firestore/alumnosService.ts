/**
 * Alumnos Service
 * Manages ALUMNOS collection in Firestore
 */

import { where, orderBy, QueryConstraint } from 'firebase/firestore';
import { FirestoreService } from './baseService';
import type { Alumno } from '../../types/alumno';
import { clasesService } from './clasesService';
import { dataValidator } from './dataValidator';

// Re-export the Alumno type for index.ts
export type { Alumno } from '../../types/alumno';

class AlumnosServiceClass extends FirestoreService<Alumno> {
    constructor() {
        super('ALUMNOS');
    }

    /**
     * Assign a student to a class (bidirectional)
     */
    async assignToClass(alumnoId: string, claseId: string): Promise<void> {
        // Validate class exists
        const classExists = await dataValidator.validateClassExists(claseId);
        if (!classExists) {
            throw new Error(`Clase ${claseId} no existe`);
        }

        // Get alumno
        const alumno = await this.getById(alumnoId);
        if (!alumno) {
            throw new Error(`Alumno ${alumnoId} no existe`);
        }

        // Add to alumno.classIds
        const classIds = alumno.classIds || [];
        if (!classIds.includes(claseId)) {
            classIds.push(claseId);
            await this.update(alumnoId, { classIds });
        }

        // Add to clase.studentIds
        const clase = await clasesService.getById(claseId);
        if (clase) {
            const studentIds = clase.studentIds || clase.alumno_ids || [];
            if (!studentIds.includes(alumnoId)) {
                studentIds.push(alumnoId);
                await clasesService.update(claseId, { studentIds });
            }
        }
    }

    /**
     * Remove a student from a class (bidirectional)
     */
    async removeFromClass(alumnoId: string, claseId: string): Promise<void> {
        // Remove from alumno.classIds
        const alumno = await this.getById(alumnoId);
        if (alumno) {
            const classIds = (alumno.classIds || []).filter(id => id !== claseId);
            await this.update(alumnoId, { classIds });
        }

        // Remove from clase.studentIds
        const clase = await clasesService.getById(claseId);
        if (clase) {
            const studentIds = (clase.studentIds || clase.alumno_ids || []).filter(id => id !== alumnoId);
            await clasesService.update(claseId, { studentIds });
        }
    }

    /**
     * Get all classes for a student
     */
    async getClasses(alumnoId: string): Promise<any[]> {
        return clasesService.getByStudent(alumnoId);
    }
    /**
     * Get all students (optionally only active), sorted by last name
     */
    async getAllStudents(activeOnly: boolean = false): Promise<Alumno[]> {
        const constraints: QueryConstraint[] = [];
        
        if (activeOnly) {
            constraints.push(where('activo', '==', true));
        }
        
        constraints.push(orderBy('apellido', 'asc'));
        
        return super.getAll(constraints);
    }

    /**
     * Get students by group
     */
    async getByGroup(groupName: string): Promise<Alumno[]> {
        return this.query('grupo', 'array-contains', groupName);
    }

    /**
     * Get students by instrument
     */
    async getByInstrument(instrument: string): Promise<Alumno[]> {
        return this.query('instrumento', '==', instrument);
    }

    /**
     * Search students by name (client-side filtering)
     */
    async search(searchTerm: string): Promise<Alumno[]> {
        const allStudents = await this.getAllStudents();
        const term = searchTerm.toLowerCase();
        return allStudents.filter(s => 
            `${s.nombre} ${s.apellido}`.toLowerCase().includes(term)
        );
    }

    /**
     * Get active students count
     */
    async getActiveCount(): Promise<number> {
        const active = await this.query('activo', '==', true);
        return active.length;
    }
}

// Singleton instance
export const alumnosService = new AlumnosServiceClass();
