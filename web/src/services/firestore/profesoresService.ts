/**
 * Profesores Service
 * Manages PROFESORES collection in Firestore
 */

import { where, orderBy, QueryConstraint } from 'firebase/firestore';
import { FirestoreService, FirestoreDocument } from './baseService';

export interface Profesor extends FirestoreDocument {
    nombre: string;
    apellido: string;
    email?: string;
    telefono?: string;
    tlf?: string;
    especialidad?: string;
    instrumento?: string;
    activo: boolean;
    avatar?: string;
    direccion?: string;
    cedula?: string;
    grupos?: string[];
    horarios?: string[];
    observaciones?: string;
}

class ProfesoresServiceClass extends FirestoreService<Profesor> {
    constructor() {
        super('PROFESORES');
    }

    async getAllProfesores(activeOnly: boolean = false): Promise<Profesor[]> {
        const constraints: QueryConstraint[] = [];
        
        if (activeOnly) {
            constraints.push(where('activo', '==', true));
        }
        
        constraints.push(orderBy('apellido', 'asc'));
        
        return super.getAll(constraints);
    }

    async getBySpecialty(specialty: string): Promise<Profesor[]> {
        return this.query('especialidad', '==', specialty);
    }

    async search(searchTerm: string): Promise<Profesor[]> {
        const all = await this.getAllProfesores();
        const term = searchTerm.toLowerCase();
        return all.filter(p => 
            `${p.nombre} ${p.apellido}`.toLowerCase().includes(term)
        );
    }
}

export const profesoresService = new ProfesoresServiceClass();
