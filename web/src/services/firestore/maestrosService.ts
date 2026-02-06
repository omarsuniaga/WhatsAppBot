/**
 * Maestros Service
 * Manages MAESTROS collection in Firestore
 * Schema based on actual Firestore data structure
 */

import { where, orderBy, QueryConstraint } from 'firebase/firestore';
import { FirestoreService, FirestoreDocument } from './baseService';
import { clasesService } from './clasesService';

// Instrument assignment for a teacher
export interface MaestroInstrument {
    id: string;
    instrument: string;
    level: string;
    teacherId: string;
    createdAt?: string;
    updatedAt?: string;
}

// Schedule entry for a teacher
export interface MaestroSchedule {
    id: string;
    class: string;
    day: string;
    start: string;
    end: string;
    teacherId: string;
    createdAt?: string;
    updatedAt?: string;
}

// Main Maestro interface matching Firestore MAESTROS collection
export interface Maestro extends FirestoreDocument {
    // Identity
    name: string;
    uid?: string;
    
    // Contact
    phone?: string;
    email?: string;
    address?: string;
    
    // Profile
    photoURL?: string;
    biography?: string;
    
    // Teaching info - simple primary instrument
    primaryInstrument?: string;
    
    // Teaching info - arrays (may be empty or not used)
    instruments?: MaestroInstrument[];
    specialties?: string[];
    schedule?: MaestroSchedule[];
    
    // Status
    status: 'active' | 'inactive' | 'pending' | string;
    
    // Metadata
    createdAt?: string;
    updatedAt?: string;
}

class MaestrosServiceClass extends FirestoreService<Maestro> {
    constructor() {
        super('MAESTROS');
    }

    async getAllMaestros(activeOnly: boolean = false): Promise<Maestro[]> {
        const constraints: QueryConstraint[] = [];
        
        if (activeOnly) {
            constraints.push(where('status', '==', 'active'));
        }
        
        constraints.push(orderBy('name', 'asc'));
        
        return super.getAll(constraints);
    }

    async getActiveTeachers(): Promise<Maestro[]> {
        return this.getAllMaestros(true);
    }

    async getBySpecialty(specialty: string): Promise<Maestro[]> {
        const all = await this.getAllMaestros();
        return all.filter(m => m.specialties?.includes(specialty));
    }

    async getByInstrument(instrument: string): Promise<Maestro[]> {
        const all = await this.getAllMaestros();
        return all.filter(m => 
            m.instruments?.some(i => i.instrument.toLowerCase() === instrument.toLowerCase())
        );
    }

    async search(searchTerm: string): Promise<Maestro[]> {
        const all = await this.getAllMaestros();
        const term = searchTerm.toLowerCase();
        return all.filter(m => 
            m.name?.toLowerCase().includes(term) ||
            m.email?.toLowerCase().includes(term) ||
            m.instruments?.some(i => i.instrument.toLowerCase().includes(term)) ||
            m.specialties?.some(s => s.toLowerCase().includes(term))
        );
    }

    /**
     * Get all classes taught by this teacher
     */
    async getClasses(maestroId: string): Promise<any[]> {
        return clasesService.getByTeacher(maestroId);
    }

    /** 
     * Get weekly schedule for a teacher
     */
    async getWeeklySchedule(maestroId: string) {
        const classes = await this.getClasses(maestroId);
        const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        const schedule: Record<string, any[]> = {};
        
        days.forEach(day => {
            schedule[day] = [];
            classes.forEach((clase: any) => {
                const slots = clase.schedule?.slots || [];
                slots.filter((slot: any) => slot.day === day).forEach((slot: any) => {
                    schedule[day].push({
                        ...slot,
                        clase: clase.name || clase.nombre,
                        claseId: clase.id
                    });
                });
            });
            // Sort by start time
            schedule[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
        });
        
        return schedule;
    }
}

export const maestrosService = new MaestrosServiceClass();
