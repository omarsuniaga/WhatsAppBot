/**
 * Emergency Classes Service
 * Manages EMERGENCY_CLASSES collection in Firestore
 */

import { where, orderBy, QueryConstraint } from 'firebase/firestore';
import { FirestoreService, FirestoreDocument } from './baseService';

export interface EmergencyClass extends FirestoreDocument {
    nombre: string;
    descripcion?: string;
    clase_original_id?: string;
    clase_original_nombre?: string;
    profesor_id?: string;
    profesor_nombre?: string;
    profesor_sustituto_id?: string;
    profesor_sustituto_nombre?: string;
    salon_id?: string;
    salon_nombre?: string;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    motivo: string;
    tipo: 'cancelacion' | 'reposicion' | 'sustituto' | 'cambio_horario' | string;
    estado: 'pendiente' | 'confirmada' | 'completada' | 'cancelada';
    notificados?: string[];
    alumnos_ids?: string[];
    notas?: string;
    activo: boolean;
}

class EmergencyClassesServiceClass extends FirestoreService<EmergencyClass> {
    constructor() {
        super('EMERGENCY_CLASSES');
    }

    async getAllEmergencyClasses(activeOnly: boolean = true): Promise<EmergencyClass[]> {
        const constraints: QueryConstraint[] = [];
        
        if (activeOnly) {
            constraints.push(where('activo', '==', true));
        }
        
        constraints.push(orderBy('fecha', 'desc'));
        
        return super.getAll(constraints);
    }

    async getByDate(date: string): Promise<EmergencyClass[]> {
        return this.query('fecha', '==', date);
    }

    async getByStatus(status: string): Promise<EmergencyClass[]> {
        return this.query('estado', '==', status);
    }

    async getPending(): Promise<EmergencyClass[]> {
        return this.query('estado', '==', 'pendiente');
    }

    async getByTeacher(teacherId: string): Promise<EmergencyClass[]> {
        return this.query('profesor_id', '==', teacherId);
    }

    async getByOriginalClass(classId: string): Promise<EmergencyClass[]> {
        return this.query('clase_original_id', '==', classId);
    }

    async getUpcoming(): Promise<EmergencyClass[]> {
        const today = new Date().toISOString().split('T')[0];
        const all = await this.getAllEmergencyClasses();
        return all.filter(ec => ec.fecha >= today && ec.estado !== 'cancelada');
    }
}

export const emergencyClassesService = new EmergencyClassesServiceClass();
