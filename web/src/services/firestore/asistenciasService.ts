/**
 * Asistencias Service
 * Manages ASISTENCIAS collection in Firestore
 */

import { where, orderBy, QueryConstraint } from 'firebase/firestore';
import { FirestoreService, FirestoreDocument } from './baseService';

export interface Asistencia extends FirestoreDocument {
    alumno_id: string;
    alumno_nombre?: string;
    clase_id: string;
    clase_nombre?: string;
    fecha: string;
    estado: 'presente' | 'ausente' | 'tardanza' | 'justificado' | 'pendiente';
    hora_entrada?: string;
    hora_salida?: string;
    observaciones?: string;
    justificacion?: string;
    registrado_por?: string;
    profesor_id?: string;
}

class AsistenciasServiceClass extends FirestoreService<Asistencia> {
    constructor() {
        super('ASISTENCIAS');
    }

    async getByDate(date: string): Promise<Asistencia[]> {
        return this.query('fecha', '==', date);
    }

    async getByStudent(studentId: string): Promise<Asistencia[]> {
        const constraints: QueryConstraint[] = [
            where('alumno_id', '==', studentId),
            orderBy('fecha', 'desc')
        ];
        return super.getAll(constraints);
    }

    async getByClass(classId: string): Promise<Asistencia[]> {
        return this.query('clase_id', '==', classId);
    }

    async getByDateRange(startDate: string, endDate: string): Promise<Asistencia[]> {
        const constraints: QueryConstraint[] = [
            where('fecha', '>=', startDate),
            where('fecha', '<=', endDate),
            orderBy('fecha', 'desc')
        ];
        return super.getAll(constraints);
    }

    async getAbsences(date?: string): Promise<Asistencia[]> {
        if (date) {
            const constraints: QueryConstraint[] = [
                where('fecha', '==', date),
                where('estado', '==', 'ausente')
            ];
            return super.getAll(constraints);
        }
        return this.query('estado', '==', 'ausente');
    }

    async getPending(): Promise<Asistencia[]> {
        return this.query('estado', '==', 'pendiente');
    }
}

export const asistenciasService = new AsistenciasServiceClass();
