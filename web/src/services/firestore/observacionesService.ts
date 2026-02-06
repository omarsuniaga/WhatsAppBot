/**
 * Observaciones Service
 * Manages OBSERVACIONES_UNIFICADAS collection in Firestore
 */

import { where, orderBy, QueryConstraint } from 'firebase/firestore';
import { FirestoreService, FirestoreDocument } from './baseService';

export interface Observacion extends FirestoreDocument {
    alumno_id: string;
    alumno_nombre?: string;
    tipo: 'comportamiento' | 'academico' | 'asistencia' | 'general' | string;
    descripcion: string;
    fecha: string;
    profesor_id?: string;
    profesor_nombre?: string;
    clase_id?: string;
    clase_nombre?: string;
    severidad?: 'leve' | 'moderada' | 'grave';
    estado?: 'pendiente' | 'atendida' | 'cerrada';
    seguimiento?: string;
    notificado_padres?: boolean;
    activo: boolean;
}

class ObservacionesServiceClass extends FirestoreService<Observacion> {
    constructor() {
        super('OBSERVACIONES_UNIFICADAS');
    }

    async getAllObservaciones(activeOnly: boolean = true): Promise<Observacion[]> {
        const constraints: QueryConstraint[] = [];
        
        if (activeOnly) {
            constraints.push(where('activo', '==', true));
        }
        
        constraints.push(orderBy('fecha', 'desc'));
        
        return super.getAll(constraints);
    }

    async getByStudent(studentId: string): Promise<Observacion[]> {
        return this.query('alumno_id', '==', studentId);
    }

    async getByType(type: string): Promise<Observacion[]> {
        return this.query('tipo', '==', type);
    }

    async getByTeacher(teacherId: string): Promise<Observacion[]> {
        return this.query('profesor_id', '==', teacherId);
    }

    async getByClass(classId: string): Promise<Observacion[]> {
        return this.query('clase_id', '==', classId);
    }

    async getPending(): Promise<Observacion[]> {
        return this.query('estado', '==', 'pendiente');
    }

    async getByDateRange(startDate: string, endDate: string): Promise<Observacion[]> {
        const all = await this.getAllObservaciones();
        return all.filter(o => o.fecha >= startDate && o.fecha <= endDate);
    }
}

export const observacionesService = new ObservacionesServiceClass();
