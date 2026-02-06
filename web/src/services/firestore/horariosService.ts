/**
 * Horarios Service
 * Manages HORARIOS collection in Firestore
 */

import { where, orderBy, QueryConstraint } from 'firebase/firestore';
import { FirestoreService, FirestoreDocument } from './baseService';

export interface Horario extends FirestoreDocument {
    clase_id?: string;
    clase_nombre?: string;
    profesor_id?: string;
    profesor_nombre?: string;
    salon_id?: string;
    salon_nombre?: string;
    dia: string;
    hora_inicio: string;
    hora_fin: string;
    duracion?: number;
    grupo?: string;
    instrumento?: string;
    tipo?: string;
    recurrente?: boolean;
    activo: boolean;
    notas?: string;
}

class HorariosServiceClass extends FirestoreService<Horario> {
    constructor() {
        super('HORARIOS');
    }

    async getAllHorarios(activeOnly: boolean = false): Promise<Horario[]> {
        const constraints: QueryConstraint[] = [];
        
        if (activeOnly) {
            constraints.push(where('activo', '==', true));
        }
        
        constraints.push(orderBy('dia', 'asc'));
        
        return super.getAll(constraints);
    }

    async getByDay(day: string): Promise<Horario[]> {
        const constraints: QueryConstraint[] = [
            where('dia', '==', day),
            where('activo', '==', true),
            orderBy('hora_inicio', 'asc')
        ];
        return super.getAll(constraints);
    }

    async getByTeacher(teacherId: string): Promise<Horario[]> {
        return this.query('profesor_id', '==', teacherId);
    }

    async getByRoom(roomId: string): Promise<Horario[]> {
        return this.query('salon_id', '==', roomId);
    }

    async getWeekSchedule(): Promise<Record<string, Horario[]>> {
        const all = await this.getAllHorarios(true);
        const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        
        const schedule: Record<string, Horario[]> = {};
        days.forEach(day => {
            schedule[day] = all.filter(h => h.dia === day).sort((a, b) => 
                a.hora_inicio.localeCompare(b.hora_inicio)
            );
        });
        
        return schedule;
    }
}

export const horariosService = new HorariosServiceClass();
