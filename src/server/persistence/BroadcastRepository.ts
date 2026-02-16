
import { db } from '../firebase';
import { CollectionReference, Query, Timestamp } from 'firebase-admin/firestore';

export interface BroadcastDocument {
    id: string;
    nombre: string;
    mensaje: string;
    destinatarios: string[];
    estado: 'borrador' | 'programado' | 'enviando' | 'completado' | 'fallido';
    fecha_programada?: any;
    fecha_envio?: any;
    enviados?: number;
    fallidos?: number;
    creado_por?: string;
    tipo?: string;
    media_url?: string;
    createdAt?: any;
    updatedAt?: any;
}

export class BroadcastRepository {
    private static instance: BroadcastRepository;
    private collection: CollectionReference;

    private constructor() {
        this.collection = db.collection('BROADCASTS');
    }

    public static getInstance(): BroadcastRepository {
        if (!BroadcastRepository.instance) {
            BroadcastRepository.instance = new BroadcastRepository();
        }
        return BroadcastRepository.instance;
    }

    /**
     * Get all broadcasts with 'programado' status that should be sent now
     */
    async getPendingExecution(): Promise<BroadcastDocument[]> {
        const now = new Date();

        // 1. Get those with status 'programado' and fecha_programada <= now
        const scheduledQuery = this.collection
            .where('estado', '==', 'programado')
            .where('fecha_programada', '<=', now);

        // 2. Also get those with status 'enviando' that might have crashed/stopped
        // (Optional: handle retries for 'enviando' longer than X minutes)

        const snapshot = await scheduledQuery.get();
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as BroadcastDocument));
    }

    /**
     * Get broadcasts with status 'enviando' (immediate sends from UI)
     */
    async getImmediateExecution(): Promise<BroadcastDocument[]> {
        const snapshot = await this.collection
            .where('estado', '==', 'enviando')
            .limit(5)
            .get();

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as BroadcastDocument));
    }

    async updateStatus(id: string, estado: BroadcastDocument['estado'], extra: Partial<BroadcastDocument> = {}): Promise<void> {
        await this.collection.doc(id).update({
            estado,
            updatedAt: Timestamp.now(),
            ...extra
        });
    }

    async updateProgress(id: string, enviados: number, fallidos: number): Promise<void> {
        await this.collection.doc(id).update({
            enviados,
            fallidos,
            updatedAt: Timestamp.now()
        });
    }

    async findById(id: string): Promise<BroadcastDocument | null> {
        const doc = await this.collection.doc(id).get();
        if (!doc.exists) return null;
        return { id: doc.id, ...doc.data() } as BroadcastDocument;
    }
}

export default BroadcastRepository;
