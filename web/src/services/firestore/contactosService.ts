/**
 * Contactos Service
 * Manages CONTACTOS collection in Firestore
 */

import { where, orderBy, QueryConstraint } from 'firebase/firestore';
import { FirestoreService, FirestoreDocument } from './baseService';

export interface Contacto extends FirestoreDocument {
    nombre: string;
    telefono: string;
    whatsapp?: string;
    email?: string;
    tipo?: 'alumno' | 'padre' | 'profesor' | 'administrativo' | 'otro';
    etiquetas?: string[];
    grupos?: string[];
    activo: boolean;
    notas?: string;
    jid?: string;
    avatar?: string;
    ultimo_contacto?: Date;
}

class ContactosServiceClass extends FirestoreService<Contacto> {
    constructor() {
        super('CONTACTOS');
    }

    async getAllContactos(activeOnly: boolean = false): Promise<Contacto[]> {
        const constraints: QueryConstraint[] = [];
        
        if (activeOnly) {
            constraints.push(where('activo', '==', true));
        }
        
        constraints.push(orderBy('nombre', 'asc'));
        
        return super.getAll(constraints);
    }

    async getByType(type: string): Promise<Contacto[]> {
        return this.query('tipo', '==', type);
    }

    async getByTag(tag: string): Promise<Contacto[]> {
        return this.query('etiquetas', 'array-contains', tag);
    }

    async getByGroup(group: string): Promise<Contacto[]> {
        return this.query('grupos', 'array-contains', group);
    }

    async search(searchTerm: string): Promise<Contacto[]> {
        const all = await this.getAllContactos();
        const term = searchTerm.toLowerCase();
        return all.filter(c => 
            c.nombre.toLowerCase().includes(term) ||
            c.telefono.includes(term)
        );
    }

    async getByPhone(phone: string): Promise<Contacto | null> {
        const results = await this.query('telefono', '==', phone);
        return results[0] || null;
    }
}

export const contactosService = new ContactosServiceClass();
