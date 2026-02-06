/**
 * TemplatesRepository - CRUD operations for message templates
 * 
 * MIGRATION NOTE: Implements ITemplatesRepository interface.
 * To migrate to Firestore, create a new class implementing the same interface.
 */

import { v4 as uuidv4 } from 'uuid';
import { FileStore, createStores, TemplatesFileData } from './FileStore';
import type { Template, TemplateCategory, TemplateVariable, ITemplatesRepository } from '../types/entities';

export class TemplatesRepository implements ITemplatesRepository {
    private store: FileStore<TemplatesFileData>;
    private static instance: TemplatesRepository | null = null;

    private constructor() {
        this.store = createStores.templates();
    }

    static getInstance(): TemplatesRepository {
        if (!TemplatesRepository.instance) {
            TemplatesRepository.instance = new TemplatesRepository();
        }
        return TemplatesRepository.instance;
    }

    async initialize(): Promise<void> {
        await this.store.ensureFileExists();
    }

    async findById(id: string): Promise<Template | null> {
        const data = await this.store.read();
        return data.templates.find(t => t.id === id) || null;
    }

    async findAll(): Promise<Template[]> {
        const data = await this.store.read();
        return data.templates;
    }

    async findBySlug(slug: string): Promise<Template | null> {
        const data = await this.store.read();
        return data.templates.find(t => t.slug === slug) || null;
    }

    async findByCategory(category: TemplateCategory): Promise<Template[]> {
        const data = await this.store.read();
        return data.templates.filter(t => t.category === category);
    }

    async findActive(): Promise<Template[]> {
        const data = await this.store.read();
        return data.templates.filter(t => t.isActive);
    }

    /**
     * Generate a URL-safe slug from the template name
     */
    private generateSlug(name: string, existingSlugs: string[]): string {
        let baseSlug = name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove accents
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        
        let slug = baseSlug;
        let counter = 1;
        
        while (existingSlugs.includes(slug)) {
            slug = `${baseSlug}-${counter}`;
            counter++;
        }
        
        return slug;
    }

    /**
     * Extract variables from template body
     */
    private extractVariables(body: string): TemplateVariable[] {
        const regex = /\{\{(\w+)\}\}/g;
        const variables = new Set<string>();
        let match;
        
        while ((match = regex.exec(body)) !== null) {
            variables.add(match[1]);
        }
        
        return Array.from(variables).map(name => ({
            name,
            required: true
        }));
    }

    async create(input: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>): Promise<Template> {
        const now = new Date().toISOString();
        const data = await this.store.read();
        
        const existingSlugs = data.templates.map(t => t.slug);
        const slug = input.slug || this.generateSlug(input.name, existingSlugs);
        
        // Auto-extract variables if not provided
        const variables = input.variables.length > 0 
            ? input.variables 
            : this.extractVariables(input.body);
        
        const template: Template = {
            ...input,
            id: uuidv4(),
            slug,
            variables,
            usageCount: 0,
            createdAt: now,
            updatedAt: now
        };

        await this.store.update(data => ({
            ...data,
            lastUpdated: now,
            templates: [...data.templates, template]
        }));

        return template;
    }

    async update(id: string, updates: Partial<Template>): Promise<Template | null> {
        const now = new Date().toISOString();
        let updated: Template | null = null;

        await this.store.update(data => {
            const index = data.templates.findIndex(t => t.id === id);
            if (index === -1) return data;

            // If body changed, re-extract variables
            let variables = data.templates[index].variables;
            if (updates.body && updates.body !== data.templates[index].body) {
                variables = this.extractVariables(updates.body);
            }

            updated = {
                ...data.templates[index],
                ...updates,
                variables: updates.variables || variables,
                id,
                createdAt: data.templates[index].createdAt,
                updatedAt: now
            };

            const newTemplates = [...data.templates];
            newTemplates[index] = updated;

            return {
                ...data,
                lastUpdated: now,
                templates: newTemplates
            };
        });

        return updated;
    }

    async delete(id: string): Promise<boolean> {
        let deleted = false;

        await this.store.update(data => {
            const index = data.templates.findIndex(t => t.id === id);
            if (index === -1) return data;

            deleted = true;
            return {
                ...data,
                lastUpdated: new Date().toISOString(),
                templates: data.templates.filter(t => t.id !== id)
            };
        });

        return deleted;
    }

    async incrementUsage(id: string): Promise<void> {
        await this.store.update(data => {
            const index = data.templates.findIndex(t => t.id === id);
            if (index === -1) return data;

            const template = data.templates[index];
            const newTemplates = [...data.templates];
            newTemplates[index] = {
                ...template,
                usageCount: template.usageCount + 1,
                lastUsedAt: new Date().toISOString()
            };

            return {
                ...data,
                templates: newTemplates
            };
        });
    }

    async search(query: string): Promise<Template[]> {
        const data = await this.store.read();
        const lowerQuery = query.toLowerCase();

        return data.templates.filter(t =>
            t.name.toLowerCase().includes(lowerQuery) ||
            t.description?.toLowerCase().includes(lowerQuery) ||
            t.body.toLowerCase().includes(lowerQuery) ||
            t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
    }

    async getCategories(): Promise<TemplateCategory[]> {
        const data = await this.store.read();
        const categories = new Set<TemplateCategory>();
        data.templates.forEach(t => categories.add(t.category));
        return Array.from(categories);
    }

    async count(): Promise<number> {
        const data = await this.store.read();
        return data.templates.length;
    }
}

export default TemplatesRepository;
