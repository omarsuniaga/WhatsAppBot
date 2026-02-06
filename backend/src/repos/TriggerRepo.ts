/**
 * TriggerRepo - Repository for Trigger entities
 */

import { BaseRepository, ValidationResult } from './BaseRepository';
import { FileStore, EntityCollection, createEntityStore } from '../storage/FileStore';
import { Trigger } from '../domain';
import { createId } from '../domain/id';

export class TriggerRepo extends BaseRepository<Trigger> {
    private static instance: TriggerRepo | null = null;

    private constructor(store: FileStore<EntityCollection<Trigger>>) {
        super(store, 'Trigger');
    }

    static getInstance(): TriggerRepo {
        if (!TriggerRepo.instance) {
            const store = createEntityStore<Trigger>('triggers.json');
            TriggerRepo.instance = new TriggerRepo(store);
        }
        return TriggerRepo.instance;
    }

    protected generateId(): string {
        return createId.trigger?.() || `tgr_${Date.now()}`;
    }

    protected validate(entity: Trigger): ValidationResult {
        const errors: string[] = [];

        if (!entity.keyword?.trim()) {
            errors.push('keyword is required');
        }
        
        const validMatchTypes = ['exact', 'contains', 'startsWith', 'regex'];
        if (!validMatchTypes.includes(entity.matchType)) {
            errors.push('Invalid matchType');
        }

        if (typeof entity.caseSensitive !== 'boolean') {
            errors.push('caseSensitive must be a boolean');
        }

        if (typeof entity.enabled !== 'boolean') {
            errors.push('enabled must be a boolean');
        }

        if (typeof entity.priority !== 'number') {
            errors.push('priority must be a number');
        }

        return { valid: errors.length === 0, errors };
    }

    // Entity-specific queries
    async findByKeyword(keyword: string): Promise<Trigger | null> {
        return this.findOne(t => t.keyword.toLowerCase() === keyword.toLowerCase());
    }

    async findActive(): Promise<Trigger[]> {
        return this.find(t => t.enabled);
    }

    async findByCategory(category: string): Promise<Trigger[]> {
        return this.find(t => t.category === category);
    }

    async findByMatchType(matchType: string): Promise<Trigger[]> {
        return this.find(t => t.matchType === matchType);
    }

    // Sort by priority descending
    async findSorted(): Promise<Trigger[]> {
        const all = await this.list();
        return all.sort((a, b) => b.priority - a.priority);
    }

    async findActiveSorted(): Promise<Trigger[]> {
        const active = await this.findActive();
        return active.sort((a, b) => b.priority - a.priority);
    }

    // Regex validation helper
    isValidRegex(pattern: string): boolean {
        try {
            new RegExp(pattern);
            return true;
        } catch {
            return false;
        }
    }

    // Increment match count
    async recordMatch(id: string): Promise<void> {
        const trigger = await this.getById(id);
        if (trigger) {
            await this.upsert({
                ...trigger,
                matchCount: (trigger.matchCount || 0) + 1,
                lastMatchedAt: Math.floor(Date.now() / 1000)
            });
        }
    }

    // Reset all match counts
    async resetStats(): Promise<void> {
        const all = await this.list();
        for (const trigger of all) {
            await this.upsert({
                ...trigger,
                matchCount: 0,
                lastMatchedAt: undefined
            });
        }
    }
}

export default TriggerRepo;
