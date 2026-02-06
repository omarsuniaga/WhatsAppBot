/**
 * Templates Service
 * Manages TEMPLATES collection in Firestore
 */

import { where, orderBy, QueryConstraint } from 'firebase/firestore';
import { FirestoreService, FirestoreDocument } from './baseService';

export interface Template extends FirestoreDocument {
    nombre: string;
    contenido: string;
    categoria?: string;
    etiquetas?: string[];
    variables?: string[];
    activo: boolean;
    uso_count?: number;
    creado_por?: string;
    tipo?: 'texto' | 'imagen' | 'documento';
    media_url?: string;
}

class TemplatesServiceClass extends FirestoreService<Template> {
    constructor() {
        super('TEMPLATES');
    }

    async getAllTemplates(activeOnly: boolean = false): Promise<Template[]> {
        const constraints: QueryConstraint[] = [];
        
        if (activeOnly) {
            constraints.push(where('activo', '==', true));
        }
        
        constraints.push(orderBy('nombre', 'asc'));
        
        return super.getAll(constraints);
    }

    async getByCategory(category: string): Promise<Template[]> {
        return this.query('categoria', '==', category);
    }

    async getMostUsed(limitCount: number = 10): Promise<Template[]> {
        const all = await this.getAllTemplates(true);
        return all
            .sort((a, b) => (b.uso_count || 0) - (a.uso_count || 0))
            .slice(0, limitCount);
    }

    async incrementUsage(id: string): Promise<void> {
        const template = await this.getById(id);
        if (template) {
            await this.update(id, { uso_count: (template.uso_count || 0) + 1 });
        }
    }

    /**
     * Parse template with variables
     */
    parseContent(content: string, variables: Record<string, string>): string {
        let result = content;
        Object.entries(variables).forEach(([key, value]) => {
            result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
        });
        return result;
    }
}

export const templatesService = new TemplatesServiceClass();
