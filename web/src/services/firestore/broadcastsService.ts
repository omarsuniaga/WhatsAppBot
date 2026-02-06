/**
 * Broadcasts Service
 * Manages BROADCASTS collection in Firestore
 */

import { orderBy, QueryConstraint } from 'firebase/firestore';
import { FirestoreService, FirestoreDocument } from './baseService';

export interface Broadcast extends FirestoreDocument {
    nombre: string;
    mensaje: string;
    template_id?: string;
    destinatarios: string[];
    destinatarios_count?: number;
    estado: 'borrador' | 'programado' | 'enviando' | 'completado' | 'fallido';
    fecha_programada?: Date;
    fecha_envio?: Date;
    enviados?: number;
    fallidos?: number;
    leidos?: number;
    creado_por?: string;
    tipo?: 'texto' | 'imagen' | 'documento' | 'audio';
    media_url?: string;
    etiquetas?: string[];
}

class BroadcastsServiceClass extends FirestoreService<Broadcast> {
    constructor() {
        super('BROADCASTS');
    }

    async getAllBroadcasts(): Promise<Broadcast[]> {
        const constraints: QueryConstraint[] = [
            orderBy('createdAt', 'desc')
        ];
        return super.getAll(constraints);
    }

    async getByStatus(status: string): Promise<Broadcast[]> {
        return this.query('estado', '==', status);
    }

    async getPending(): Promise<Broadcast[]> {
        return this.query('estado', '==', 'programado');
    }

    async getRecent(limitCount: number = 10): Promise<Broadcast[]> {
        const all = await this.getAllBroadcasts();
        return all.slice(0, limitCount);
    }
}

export const broadcastsService = new BroadcastsServiceClass();
