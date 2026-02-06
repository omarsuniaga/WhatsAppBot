/**
 * Salones Service
 * Manages SALONES collection in Firestore
 */

import { where, orderBy, QueryConstraint } from 'firebase/firestore';
import { FirestoreService, FirestoreDocument } from './baseService';

export interface Salon extends FirestoreDocument {
    nombre: string;
    descripcion?: string;
    capacidad?: number;
    ubicacion?: string;
    piso?: string | number;
    edificio?: string;
    equipamiento?: string[];
    activo: boolean;
    disponible?: boolean;
    tipo?: string;
    observaciones?: string;
}

class SalonesServiceClass extends FirestoreService<Salon> {
    constructor() {
        super('SALONES');
    }

    async getAllSalones(activeOnly: boolean = false): Promise<Salon[]> {
        const constraints: QueryConstraint[] = [];
        
        if (activeOnly) {
            constraints.push(where('activo', '==', true));
        }
        
        constraints.push(orderBy('nombre', 'asc'));
        
        return super.getAll(constraints);
    }

    async getAvailable(): Promise<Salon[]> {
        return this.query('disponible', '==', true);
    }

    async getByCapacity(minCapacity: number): Promise<Salon[]> {
        const all = await this.getAllSalones(true);
        return all.filter(s => (s.capacidad || 0) >= minCapacity);
    }
}

export const salonesService = new SalonesServiceClass();
