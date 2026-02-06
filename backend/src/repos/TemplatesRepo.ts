/**
 * TemplatesRepo - Repository for Template entities
 */

import { BaseRepository, ValidationResult } from './BaseRepository';
import { FileStore, EntityCollection, createEntityStore } from '../storage/FileStore';
import { Template, TemplateCategory, TemplateStatus } from '../domain';
import { createId } from '../domain/id';

export class TemplatesRepo extends BaseRepository<Template> {
    private static instance: TemplatesRepo | null = null;

    private constructor(store: FileStore<EntityCollection<Template>>) {
        super(store, 'Template');
    }

    static getInstance(): TemplatesRepo {
        if (!TemplatesRepo.instance) {
            const store = createEntityStore<Template>('templates.json');
            TemplatesRepo.instance = new TemplatesRepo(store);
        }
        return TemplatesRepo.instance;
    }

    protected generateId(): string {
        return createId.template();
    }

    protected validate(entity: Template): ValidationResult {
        const errors: string[] = [];

        if (!entity.name?.trim()) {
            errors.push('name is required');
        }
        if (!entity.code?.trim()) {
            errors.push('code is required');
        }
        if (!entity.body?.trim()) {
            errors.push('body is required');
        }
        if (!entity.category || !Object.values(TemplateCategory).includes(entity.category)) {
            errors.push('Valid category is required');
        }
        if (!entity.status || !Object.values(TemplateStatus).includes(entity.status)) {
            errors.push('Valid status is required');
        }

        return { valid: errors.length === 0, errors };
    }

    // Entity-specific queries
    async findByCategory(category: TemplateCategory): Promise<Template[]> {
        return this.find(t => t.category === category);
    }

    async findByStatus(status: TemplateStatus): Promise<Template[]> {
        return this.find(t => t.status === status);
    }

    async findActive(): Promise<Template[]> {
        return this.find(t => t.status === TemplateStatus.Active);
    }

    async findByCode(code: string): Promise<Template | null> {
        return this.findOne(t => t.code === code);
    }

    async findByTag(tag: string): Promise<Template[]> {
        return this.find(t => t.tags.includes(tag));
    }

    async incrementUseCount(id: string): Promise<void> {
        const template = await this.getById(id);
        if (template) {
            await this.upsert({
                ...template,
                useCount: (template.useCount || 0) + 1,
                lastUsedAt: Math.floor(Date.now() / 1000)
            });
        }
    }
}

export default TemplatesRepo;
