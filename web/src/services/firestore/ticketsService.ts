/**
 * Tickets Service
 * Manages TICKETS collection in Firestore
 */

import { where, orderBy, QueryConstraint } from 'firebase/firestore';
import { FirestoreService, FirestoreDocument } from './baseService';

export interface Ticket extends FirestoreDocument {
    titulo: string;
    descripcion: string;
    contacto_id?: string;
    contacto_nombre?: string;
    contacto_telefono?: string;
    estado: 'abierto' | 'en_progreso' | 'pendiente' | 'resuelto' | 'cerrado';
    prioridad: 'baja' | 'media' | 'alta' | 'urgente';
    categoria?: string;
    asignado_a?: string;
    mensajes?: any[];
    chat_id?: string;
    resolucion?: string;
    fecha_resolucion?: Date;
}

class TicketsServiceClass extends FirestoreService<Ticket> {
    constructor() {
        super('TICKETS');
    }

    async getAllTickets(): Promise<Ticket[]> {
        const constraints: QueryConstraint[] = [
            orderBy('createdAt', 'desc')
        ];
        return super.getAll(constraints);
    }

    async getOpen(): Promise<Ticket[]> {
        const constraints: QueryConstraint[] = [
            where('estado', 'in', ['abierto', 'en_progreso', 'pendiente']),
            orderBy('prioridad', 'desc')
        ];
        return super.getAll(constraints);
    }

    async getByStatus(status: string): Promise<Ticket[]> {
        return this.query('estado', '==', status);
    }

    async getByPriority(priority: string): Promise<Ticket[]> {
        return this.query('prioridad', '==', priority);
    }

    async getByContact(contactId: string): Promise<Ticket[]> {
        return this.query('contacto_id', '==', contactId);
    }

    async getAssignedTo(userId: string): Promise<Ticket[]> {
        return this.query('asignado_a', '==', userId);
    }

    async resolve(id: string, resolution: string): Promise<void> {
        await this.update(id, {
            estado: 'resuelto',
            resolucion: resolution,
            fecha_resolucion: new Date()
        });
    }
}

export const ticketsService = new TicketsServiceClass();
