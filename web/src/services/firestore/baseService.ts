/**
 * Base Firestore Service
 * Provides generic CRUD operations for any collection
 */

import { 
    collection, 
    doc, 
    getDocs, 
    getDoc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where,
    Timestamp,
    DocumentData,
    QueryConstraint,
    onSnapshot,
    Unsubscribe
} from 'firebase/firestore';
import { db } from '../../lib/firebase';

export interface FirestoreDocument {
    id: string;
    createdAt?: Date | Timestamp | string;
    updatedAt?: Date | Timestamp | string;
    [key: string]: any;
}

/**
 * Generic Firestore Service
 * Provides CRUD operations for any Firestore collection
 */
export class FirestoreService<T extends FirestoreDocument> {
    protected collectionName: string;

    constructor(collectionName: string) {
        this.collectionName = collectionName;
    }

    /**
     * Get collection reference
     */
    protected getCollectionRef() {
        return collection(db, this.collectionName);
    }

    /**
     * Get document reference
     */
    protected getDocRef(id: string) {
        return doc(db, this.collectionName, id);
    }

    /**
     * Convert Firestore timestamps to Date objects
     */
    protected convertTimestamps(data: DocumentData): T {
        const result = { ...data } as T;
        
        // Convert timestamp fields
        if ((result as any).createdAt instanceof Timestamp) {
            (result as any).createdAt = (result as any).createdAt.toDate();
        }
        if ((result as any).updatedAt instanceof Timestamp) {
            (result as any).updatedAt = (result as any).updatedAt.toDate();
        }
        
        return result;
    }

    /**
     * Remove undefined values from an object recursively
     * Firestore does not support undefined values
     */
    protected sanitizeData(data: any): any {
        if (data === null || typeof data !== 'object') {
            return data;
        }

        if (Array.isArray(data)) {
            return data.map(v => this.sanitizeData(v));
        }

        const sanitized: any = {};
        Object.keys(data).forEach(key => {
            if (data[key] !== undefined) {
                sanitized[key] = this.sanitizeData(data[key]);
            }
        });
        return sanitized;
    }

    /**
     * Get all documents from collection
     */
    async getAll(constraints: QueryConstraint[] = []): Promise<T[]> {
        try {
            const q = query(this.getCollectionRef(), ...constraints);
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => {
                const data = this.convertTimestamps(doc.data());
                return { ...data, id: doc.id };
            });
        } catch (error) {
            console.error(`Error getting ${this.collectionName}:`, error);
            throw error;
        }
    }

    /**
     * Get a single document by ID
     */
    async getById(id: string): Promise<T | null> {
        try {
            const docSnap = await getDoc(this.getDocRef(id));
            if (!docSnap.exists()) return null;
            const data = this.convertTimestamps(docSnap.data());
            return { ...data, id: docSnap.id };
        } catch (error) {
            console.error(`Error getting ${this.collectionName}/${id}:`, error);
            throw error;
        }
    }

    /**
     * Create a new document
     */
    async create(data: Omit<T, 'id'>): Promise<string> {
        try {
            const sanitized = this.sanitizeData(data);
            const docRef = await addDoc(this.getCollectionRef(), {
                ...sanitized,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            });
            return docRef.id;
        } catch (error) {
            console.error(`Error creating ${this.collectionName}:`, error);
            throw error;
        }
    }

    /**
     * Update an existing document
     */
    async update(id: string, data: Partial<T>): Promise<void> {
        try {
            // Remove id and createdAt from update data
            const { id: _id, createdAt: _created, ...updateData } = data as any;
            const sanitized = this.sanitizeData(updateData);
            
            await updateDoc(this.getDocRef(id), {
                ...sanitized,
                updatedAt: Timestamp.now()
            });
        } catch (error) {
            console.error(`Error updating ${this.collectionName}/${id}:`, error);
            throw error;
        }
    }

    /**
     * Delete a document (hard delete)
     */
    async delete(id: string): Promise<void> {
        try {
            await deleteDoc(this.getDocRef(id));
        } catch (error) {
            console.error(`Error deleting ${this.collectionName}/${id}:`, error);
            throw error;
        }
    }

    /**
     * Soft delete (set activo = false)
     */
    async softDelete(id: string): Promise<void> {
        try {
            await this.update(id, { activo: false } as unknown as Partial<T>);
        } catch (error) {
            console.error(`Error soft-deleting ${this.collectionName}/${id}:`, error);
            throw error;
        }
    }

    /**
     * Query documents with filters
     */
    async query(
        field: string, 
        operator: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'array-contains' | 'in',
        value: any
    ): Promise<T[]> {
        try {
            const q = query(this.getCollectionRef(), where(field, operator, value));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => {
                const data = this.convertTimestamps(doc.data());
                return { ...data, id: doc.id };
            });
        } catch (error) {
            console.error(`Error querying ${this.collectionName}:`, error);
            throw error;
        }
    }

    /**
     * Subscribe to real-time updates
     */
    subscribe(callback: (data: T[]) => void, constraints: QueryConstraint[] = []): Unsubscribe {
        const q = query(this.getCollectionRef(), ...constraints);
        return onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => {
                const docData = this.convertTimestamps(doc.data());
                return { ...docData, id: doc.id };
            });
            callback(data);
        });
    }

    /**
     * Subscribe to a single document
     */
    subscribeToDoc(id: string, callback: (data: T | null) => void): Unsubscribe {
        return onSnapshot(this.getDocRef(id), (docSnap) => {
            if (!docSnap.exists()) {
                callback(null);
                return;
            }
            const data = this.convertTimestamps(docSnap.data());
            callback({ ...data, id: docSnap.id });
        });
    }
}
