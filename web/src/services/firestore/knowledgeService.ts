/**
 * Knowledge Base Service
 * Manages KNOWLEDGE_BASE collection in Firestore
 */

import { where, orderBy, QueryConstraint } from 'firebase/firestore';
import { FirestoreService, FirestoreDocument } from './baseService';

export interface KnowledgeEntry extends FirestoreDocument {
    titulo: string;
    contenido: string;
    categoria?: string;
    etiquetas?: string[];
    keywords?: string[];
    activo: boolean;
    prioridad?: number;
    respuesta_rapida?: string;
    tipo?: 'faq' | 'info' | 'proceso' | 'contacto';
    uso_count?: number;
    efectividad?: number;
}

class KnowledgeServiceClass extends FirestoreService<KnowledgeEntry> {
    constructor() {
        super('KNOWLEDGE_BASE');
    }

    async getAllEntries(activeOnly: boolean = true): Promise<KnowledgeEntry[]> {
        const constraints: QueryConstraint[] = [];
        
        if (activeOnly) {
            constraints.push(where('activo', '==', true));
        }
        
        constraints.push(orderBy('prioridad', 'desc'));
        
        return super.getAll(constraints);
    }

    async getByCategory(category: string): Promise<KnowledgeEntry[]> {
        return this.query('categoria', '==', category);
    }

    async searchByKeyword(keyword: string): Promise<KnowledgeEntry[]> {
        // Search in keywords array
        const byKeywords = await this.query('keywords', 'array-contains', keyword.toLowerCase());
        
        // Also search in content (client-side)
        const all = await this.getAllEntries();
        const byContent = all.filter(entry => 
            entry.titulo.toLowerCase().includes(keyword.toLowerCase()) ||
            entry.contenido.toLowerCase().includes(keyword.toLowerCase())
        );

        // Merge and deduplicate
        const merged = [...byKeywords];
        byContent.forEach(entry => {
            if (!merged.find(e => e.id === entry.id)) {
                merged.push(entry);
            }
        });

        return merged;
    }

    async getMostUsed(limitCount: number = 10): Promise<KnowledgeEntry[]> {
        const all = await this.getAllEntries();
        return all
            .sort((a, b) => (b.uso_count || 0) - (a.uso_count || 0))
            .slice(0, limitCount);
    }

    async incrementUsage(id: string): Promise<void> {
        const entry = await this.getById(id);
        if (entry) {
            await this.update(id, { uso_count: (entry.uso_count || 0) + 1 });
        }
    }
}

export const knowledgeService = new KnowledgeServiceClass();
