import { db } from '../../lib/firebase';
import {
    collection,
    doc,
    getDocs,
    addDoc,
    updateDoc,
    query,
    where,
    orderBy,
    Timestamp
} from 'firebase/firestore';

export interface Holiday {
    id?: string;
    fecha: string; // YYYY-MM-DD format
    nombre: string;
    descripcion?: string;
    creado_por: string;
    creado_en: Date;
    activo: boolean;
}

const COLLECTION = 'feriados';

class HolidaysService {
    async create(holiday: Omit<Holiday, 'id'>): Promise<string> {
        try {
            const docRef = await addDoc(collection(db, COLLECTION), {
                ...holiday,
                creado_en: Timestamp.fromDate(holiday.creado_en)
            });
            return docRef.id;
        } catch (error) {
            console.error('Error creating holiday:', error);
            throw error;
        }
    }

    async getByDate(fecha: string): Promise<Holiday | null> {
        try {
            const q = query(
                collection(db, COLLECTION),
                where('fecha', '==', fecha),
                where('activo', '==', true)
            );
            const snapshot = await getDocs(q);

            if (snapshot.empty) return null;

            const doc = snapshot.docs[0];
            return {
                id: doc.id,
                ...doc.data(),
                creado_en: doc.data().creado_en?.toDate()
            } as Holiday;
        } catch (error) {
            console.error('Error getting holiday by date:', error);
            throw error;
        }
    }

    async getByDateRange(start: string, end: string): Promise<Holiday[]> {
        try {
            const q = query(
                collection(db, COLLECTION),
                where('fecha', '>=', start),
                where('fecha', '<=', end),
                where('activo', '==', true),
                orderBy('fecha', 'asc')
            );
            const snapshot = await getDocs(q);

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                creado_en: doc.data().creado_en?.toDate()
            } as Holiday));
        } catch (error) {
            console.error('Error getting holidays by date range:', error);
            throw error;
        }
    }

    async getAll(): Promise<Holiday[]> {
        try {
            const q = query(
                collection(db, COLLECTION),
                where('activo', '==', true),
                orderBy('fecha', 'desc')
            );
            const snapshot = await getDocs(q);

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                creado_en: doc.data().creado_en?.toDate()
            } as Holiday));
        } catch (error) {
            console.error('Error getting all holidays:', error);
            throw error;
        }
    }

    async update(id: string, data: Partial<Holiday>): Promise<void> {
        try {
            const docRef = doc(db, COLLECTION, id);
            await updateDoc(docRef, data as any);
        } catch (error) {
            console.error('Error updating holiday:', error);
            throw error;
        }
    }

    async delete(id: string): Promise<void> {
        try {
            const docRef = doc(db, COLLECTION, id);
            await updateDoc(docRef, { activo: false });
        } catch (error) {
            console.error('Error deleting holiday:', error);
            throw error;
        }
    }
}

export const holidaysService = new HolidaysService();
